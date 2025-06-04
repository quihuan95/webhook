const express = require("express");
const bodyParser = require("body-parser");
const request = require("request");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

app.get("/webhook", (req, res) => {
	const mode = req.query["hub.mode"];
	const token = req.query["hub.verify_token"];
	const challenge = req.query["hub.challenge"];

	if (mode === "subscribe" && token === VERIFY_TOKEN) {
		console.log("✅ Webhook verified");
		res.status(200).send(challenge);
	} else {
		res.sendStatus(403);
	}
});

app.post("/webhook", (req, res) => {
	const body = req.body;
	if (body.object === "page") {
		body.entry.forEach((entry) => {
			const event = entry.messaging[0];
			const sender_psid = event.sender.id;

			if (event.message && event.message.text) {
				console.log(`📨 Tin nhắn từ ${sender_psid}: ${event.message.text}`);
				sendMessage(
					sender_psid,
					`Bot Bố đẹp trai đã nhận được: "${event.message.text}" 😎`
				);
			}
		});

		res.status(200).send("EVENT_RECEIVED");
	} else {
		res.sendStatus(404);
	}
});

function sendMessage(psid, message) {
	const payload = {
		recipient: { id: psid },
		message: { text: message },
	};

	request(
		{
			uri: "https://graph.facebook.com/v18.0/me/messages",
			qs: { access_token: PAGE_ACCESS_TOKEN },
			method: "POST",
			json: payload,
		},
		(err) => {
			if (!err) console.log("✅ Đã gửi tin nhắn");
			else console.error("❌ Gửi lỗi:", err);
		}
	);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));
