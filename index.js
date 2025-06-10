const express = require("express");
const bodyParser = require("body-parser");
const { GoogleGenAI } = require("@google/genai");
const request = require("request");
require("dotenv").config();

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const app = express();
app.use(bodyParser.json());

let sessions = {};
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

function getChatHistory(psid) {
	if (!sessions[psid]) {
		sessions[psid] = [
			{
				role: "system",
				parts: [
					{
						text: "Bạn là BốBot – một trợ lý AI cho sự kiện VINATOM. Trả lời bằng tiếng Việt, phong cách ngắn gọn, hài hước, có chiều sâu.",
					},
				],
			},
		];
	}
	return sessions[psid];
}

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

app.post("/webhook", async (req, res) => {
	const body = req.body;

	if (body.object === "page") {
		for (const entry of body.entry) {
			const event = entry.messaging[0];
			const sender_psid = event.sender.id;

			if (event.message && event.message.text) {
				const userText = event.message.text;

				// 1. Lấy lịch sử chat cho PSID đó
				const chatHistory = getChatHistory(sender_psid);

				// 2. Thêm tin nhắn mới vào
				chatHistory.push({ role: "user", parts: [{ text: userText }] });

				try {
					const reply = await callGeminiWithHistory(chatHistory);

					// 3. Lưu phản hồi lại để giữ mạch hội thoại
					chatHistory.push({ role: "model", parts: [{ text: reply }] });

					// 4. Gửi trả cho người dùng
					sendMessage(sender_psid, reply);
				} catch (err) {
					console.error("Gemini lỗi:", err.message);
					sendMessage(
						sender_psid,
						"⚡ Xin lỗi, BốBot đang lag, thử lại sau nhé!"
					);
				}
			}
		}

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

async function callGemini(promptHistory) {
	const result = await genAI.models.generateContent({
		model: "gemini-2.0-flash",
		contents: promptHistory,
	});
	const response = result.text;
	return response;

	// return response.text();
}

setTimeout(() => {
	callGemini([{ role: "user", parts: [{ text: "Tôi có một con gà" }] }]).then(
		(reply) => {
			console.log(reply);
		}
	);
}, 5000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));
