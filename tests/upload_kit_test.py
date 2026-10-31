import importlib.util
from email import policy
from email.parser import BytesParser
from pathlib import Path
import unittest
from unittest.mock import patch, MagicMock
import io
import urllib.error

spec = importlib.util.spec_from_file_location("upload_local", Path(__file__).resolve().parents[1] / "scripts/upload-local.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class UploadKitTest(unittest.TestCase):
    def test_request_is_multipart_and_secret_only_in_authorization(self):
        request = module.make_request("123456", "fake-only-app-secret", b"ZIP-content")
        self.assertEqual(request.full_url, "https://graph-video.facebook.com/123456/assets")
        self.assertEqual(request.get_header("Authorization"), "Bearer 123456|fake-only-app-secret")
        self.assertNotIn(b"fake-only-app-secret", request.data)
        message = BytesParser(policy=policy.default).parsebytes(
            ("Content-Type: " + request.get_header("Content-type") + "\r\n\r\n").encode() + request.data
        )
        fields = {part.get_param("name", header="content-disposition"): part for part in message.iter_parts()}
        self.assertEqual(fields["type"].get_content().strip(), "BUNDLE")
        self.assertEqual(fields["asset"].get_filename(), "maguro-escape.zip")
        self.assertEqual(fields["asset"].get_payload(decode=True), b"ZIP-content")

    def test_invalid_credentials_rejected(self):
        for app_id, secret in [("../other", "secret"), ("123", ""), ("123", "secret\r\nheader")]:
            with self.assertRaises(ValueError):
                module.make_request(app_id, secret, b"zip")

    def test_response_and_errors_do_not_echo_secrets(self):
        request = module.make_request("123", "fake-only-secret", b"zip")
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"success":true}'
        opener = MagicMock()
        opener.open.return_value = response
        with patch.object(module.urllib.request, "build_opener", return_value=opener):
            module.upload(request)
            opener.open.side_effect = urllib.error.HTTPError(request.full_url, 400, "bad", {}, io.BytesIO(b'{"error":{"code":190,"message":"fake-only-secret"}}'))
            with self.assertRaises(ValueError) as caught:
                module.upload(request)
            self.assertIn("190", str(caught.exception))
            self.assertNotIn("fake-only-secret", str(caught.exception))

    def test_redirect_is_not_followed(self):
        self.assertIsNone(module.NoRedirect().redirect_request(None, None, 302, "", {}, "https://example.com"))


if __name__ == "__main__":
    unittest.main()
