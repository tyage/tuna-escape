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
    def test_env_file_parses_literals_without_executing_shell(self):
        self.assertEqual(module.credentials_from_text('\ufeff# comment\nexport APP_ID="123"\nAPP_SECRET=\'$(not-executed)\'\n'), ("123", "$(not-executed)"))
        self.assertEqual(module.credentials_from_text('META_APP_ID=456 # comment\nMETA_APP_SECRET=fake-only-secret\n'), ("456", "fake-only-secret"))

    def test_env_errors_never_include_file_contents(self):
        for text in ["APP_ID=123", "APP_SECRET=fake-only-secret", "fake-only-secret"]:
            with self.assertRaises(ValueError) as caught:
                module.credentials_from_text(text)
            self.assertNotIn("fake-only-secret", str(caught.exception))

    def test_proxy_rejection_is_not_reported_as_meta_auth_failure(self):
        opener = MagicMock()
        opener.open.side_effect = urllib.error.URLError("Tunnel connection failed: 403 Forbidden")
        with patch.object(module.urllib.request, "build_opener", return_value=opener):
            with self.assertRaisesRegex(ValueError, "CONNECT 403"):
                module.upload(module.make_request("123", "fake-only-secret", b"zip"))

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
        self.assertEqual(fields["asset"].get_content_type(), "application/octet-stream")
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
