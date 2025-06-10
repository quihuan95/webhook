const express = require("express");
const bodyParser = require("body-parser");
const { Configuration, OpenAIApi } = require("openai");
const request = require("request");
require("dotenv").config();

const configuration = new Configuration({
	apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

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
				callGPT(event.message.text)
					.then((gptReply) => {
						sendMessage(sender_psid, gptReply);
					})
					.catch((err) => {
						console.error("❌ GPT lỗi:", err);
						sendMessage(sender_psid, "Xin lỗi, AI đang lag tí 😅");
					});
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

async function callGPT(messageText) {
	const completion = await openai.createChatCompletion({
		model: "gpt-3.5-turbo",
		messages: [{ role: "user", content: messageText }],
	});
	return completion.data.choices[0].message.content.trim();
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));
