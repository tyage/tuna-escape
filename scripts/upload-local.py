#!/usr/bin/env python3
"""Standalone local uploader. Credentials stay in memory and are never logged."""
import argparse
import getpass
import json
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request
import uuid
from zipfile import ZipFile


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def validate_bundle(path):
    with ZipFile(path) as archive:
        if archive.testzip() is not None:
            raise ValueError("ZIP が破損しています。再ダウンロードしてください。")
        if not {"index.html", "fbapp-config.json"}.issubset(archive.namelist()):
            raise ValueError("ゲーム本体の ZIP を同じフォルダーに置いてください。")


def credentials_from_text(text):
    fields = {}
    for line in text.lstrip("\ufeff").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        match = re.fullmatch(r"(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)", line)
        if not match:
            raise ValueError("env ファイルに読み取れない行があります。KEY=VALUE 形式を確認してください。")
        value = match[2].strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        else:
            value = re.split(r"\s+#", value, maxsplit=1)[0].rstrip()
        fields[match[1]] = value
    app_id = fields.get("META_APP_ID") or fields.get("APP_ID")
    app_secret = fields.get("META_APP_SECRET") or fields.get("APP_SECRET")
    if not app_id or not app_secret:
        raise ValueError("env ファイルに APP_ID と APP_SECRET が必要です。")
    return app_id, app_secret


def make_request(app_id, app_secret, bundle):
    if not re.fullmatch(r"[0-9]+", app_id):
        raise ValueError("App ID は半角数字で入力してください。")
    if not app_secret or any(ord(char) < 33 or ord(char) > 126 for char in app_secret):
        raise ValueError("App Secret が空か、使用できない文字を含んでいます。")
    boundary = "maguro-" + uuid.uuid4().hex
    chunks = []
    for name, value in [("type", "BUNDLE"), ("comment", "Maguro Escape development build")]:
        chunks.append((f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n').encode())
    chunks.append((f'--{boundary}\r\nContent-Disposition: form-data; name="asset"; filename="maguro-escape.zip"\r\nContent-Type: application/octet-stream\r\n\r\n').encode())
    chunks.extend([bundle, f"\r\n--{boundary}--\r\n".encode()])
    return urllib.request.Request(
        f"https://graph-video.facebook.com/{app_id}/assets",
        data=b"".join(chunks),
        headers={
            "Authorization": f"Bearer {app_id}|{app_secret}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )


def upload(request):
    # Use the system's TLS trust and inherited proxy. Never forward credentials
    # to a redirect target, and never print a raw server error containing secrets.
    opener = urllib.request.build_opener(NoRedirect())
    try:
        with opener.open(request, timeout=120) as response:
            result = json.loads(response.read(1024 * 1024))
    except urllib.error.HTTPError as error:
        code = None
        try:
            code = json.loads(error.read(1024 * 1024)).get("error", {}).get("code")
        except (ValueError, AttributeError):
            pass
        suffix = f" / Meta error code {code}" if type(code) is int else ""
        raise ValueError(f"Meta がアップロードを拒否しました。HTTP {error.code}{suffix}") from None
    except urllib.error.URLError as error:
        if "Tunnel connection failed" in str(error.reason) and "403" in str(error.reason):
            raise ValueError("HTTPS中継サーバーが接続を拒否しました（CONNECT 403）。Meta APIには到達していません。") from None
        raise ValueError("接続に失敗しました。通信設定と Meta の利用状況を確認してください。") from None
    except (TimeoutError, ValueError, OSError):
        raise ValueError("接続または応答の確認に失敗しました。通信設定と Meta の利用状況を確認してください。") from None
    if not isinstance(result, dict) or result.get("error") or not (
        result.get("success") is True or isinstance(result.get("id"), str) or isinstance(result.get("asset_id"), str)
    ):
        raise ValueError("成功応答を確認できませんでした。Meta 管理画面でビルド状態を確認してください。")


def main():
    parser = argparse.ArgumentParser(description="Meta Instant Games ローカルアップローダー")
    parser.add_argument("--check", action="store_true", help="認証・送信をせず、ZIP の整合性だけを確認")
    parser.add_argument("--env-file", type=Path, help="APP_ID と APP_SECRET を記載した既存ファイル")
    args = parser.parse_args()
    bundle = Path(__file__).resolve().with_name("maguro-escape.zip")
    try:
        validate_bundle(bundle)
        credentials = credentials_from_text(args.env_file.read_text(encoding="utf-8-sig")) if args.env_file else None
        if args.check:
            if credentials:
                make_request(*credentials, b"")
                print("ゲーム ZIP の整合性・認証ファイル形式: OK（ネットワーク送信なし）")
            else:
                print("ゲーム ZIP の整合性確認: OK（ネットワーク送信なし）")
            return 0
        if not credentials and (not sys.stdin.isatty() or not sys.stderr.isatty()):
            raise ValueError("App Secret を非表示で入力するため、手元のターミナルから実行してください。")
        print("Meta に開発用ビルドをアップロードします。一般公開は行いません。")
        print("入力した認証情報はファイルに保存しません。")
        if credentials:
            app_id, app_secret = credentials
        else:
            app_id = input("App ID: ").strip()
            app_secret = getpass.getpass("App Secret（入力しても表示されません）: ")
        request = make_request(app_id, app_secret, bundle.read_bytes())
        upload(request)
        print("Meta がアップロードを受理しました。管理画面で処理結果を確認してください。")
        return 0
    except (OSError, ValueError) as error:
        if isinstance(error, ValueError):
            print(str(error), file=sys.stderr)
        else:
            print("入力ファイルの読み込みに失敗しました。ゲーム ZIP と指定した env ファイルの場所を確認してください。", file=sys.stderr)
        return 1
    except (KeyboardInterrupt, EOFError):
        print("\n中止しました。", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
