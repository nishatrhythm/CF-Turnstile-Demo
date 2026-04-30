from flask import Flask, render_template, request, jsonify
import requests

app = Flask(__name__)

SITEKEYS = {
    "pass_visible": {
        "key": "1x00000000000000000000AA",
        "label": "Always Pass (Visible)",
        "type": "Visible"
    },
    "fail_visible": {
        "key": "2x00000000000000000000AB",
        "label": "Always Fail (Visible)",
        "type": "Visible"
    },
    "pass_invisible": {
        "key": "1x00000000000000000000BB",
        "label": "Always Pass (Invisible)",
        "type": "Invisible"
    },
    "fail_invisible": {
        "key": "2x00000000000000000000BB",
        "label": "Always Fail (Invisible)",
        "type": "Invisible"
    },
    "challenge": {
        "key": "3x00000000000000000000FF",
        "label": "Force Challenge",
        "type": "Visible"
    }
}

SECRETS = {
    "pass": {
        "key": "1x0000000000000000000000000000000AA",
        "label": "Always Pass"
    },
    "fail": {
        "key": "2x0000000000000000000000000000000AA",
        "label": "Always Fail"
    },
    "duplicate": {
        "key": "3x0000000000000000000000000000000AA",
        "label": "Token Already Spent"
    }
}

SCENARIOS = {
    "successful_login": {
        "title": "Successful login",
        "description": "A real user passes the check and the server accepts the token.",
        "sitekey": "pass_visible",
        "secret": "pass",
        "expected": "success"
    },
    "bot_blocked": {
        "title": "Bot blocked",
        "description": "A bot fails the challenge and the server rejects the token.",
        "sitekey": "fail_visible",
        "secret": "fail",
        "expected": "fail"
    },
    "replay_attack": {
        "title": "Replay attack detected",
        "description": "A valid token is reused. The server detects the duplicate and rejects it.",
        "sitekey": "pass_visible",
        "secret": "duplicate",
        "expected": "fail"
    },
    "mismatched_keys": {
        "title": "Mismatched keys",
        "description": "The token was issued for one site but verified with the wrong secret.",
        "sitekey": "pass_visible",
        "secret": "fail",
        "expected": "fail"
    }
}

ERROR_CODES = {
    "missing-input-secret": "The secret parameter was not passed.",
    "invalid-input-secret": "The secret parameter was invalid or did not exist.",
    "missing-input-response": "The response parameter (token) was not passed.",
    "invalid-input-response": "The response parameter is invalid or has expired.",
    "bad-request": "The request was rejected because it was malformed.",
    "timeout-or-duplicate": "The response parameter has already been validated before.",
    "internal-error": "An internal error happened while validating the response."
}

CLOUDFLARE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


@app.route("/")
def index():
    return render_template(
        "index.html",
        sitekeys=SITEKEYS,
        secrets=SECRETS,
        scenarios=SCENARIOS,
        error_codes=ERROR_CODES
    )


@app.route("/verify", methods=["POST"])
def verify():
    data = request.get_json()
    token = data.get("token")
    secret_id = data.get("secret_id")

    if not token:
        return jsonify({"success": False, "error": "No token provided", "raw_response": None}), 400

    if secret_id not in SECRETS:
        return jsonify({"success": False, "error": "Invalid secret id", "raw_response": None}), 400

    secret_key = SECRETS[secret_id]["key"]

    try:
        response = requests.post(
            CLOUDFLARE_VERIFY_URL,
            data={"secret": secret_key, "response": token, "remoteip": request.remote_addr},
            timeout=10
        )
        cf_response = response.json()

        return jsonify({
            "success": cf_response.get("success", False),
            "raw_response": cf_response,
            "secret_key_used": secret_key,
            "token_sent": token
        })

    except requests.exceptions.RequestException as e:
        return jsonify({"success": False, "error": str(e), "raw_response": None}), 500


if __name__ == "__main__":
    app.run(debug=True)