const axios = require('axios');

async function sendEmergencyCard(requestData, score, reasoning) {
    const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL;
    
    if (!webhookUrl) {
        console.log("No Google Chat Webhook URL configured. Skipping alert dispatch.");
        return;
    }

    const payload = {
        cardsV2: [
            {
                cardId: requestData.id || "emergency_alert",
                card: {
                    header: {
                        title: "🚨 URGENT: NGO Command Alert",
                        subtitle: "High Priority Emergency Detected by AI",
                        imageUrl: "https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/warning/default/48px.svg",
                        imageType: "CIRCLE"
                    },
                    sections: [
                        {
                            header: "Emergency Details",
                            widgets: [
                                {
                                    decoratedText: {
                                        topLabel: "Location",
                                        text: `<b>${requestData.location}</b>`
                                    }
                                },
                                {
                                    decoratedText: {
                                        topLabel: "Resource Requested",
                                        text: `${requestData.type.toUpperCase()} (For ${requestData.peopleCount} individuals)`
                                    }
                                }
                            ]
                        },
                        {
                            header: "AI Assessment",
                            widgets: [
                                {
                                    decoratedText: {
                                        topLabel: "AI Priority Score",
                                        text: `<font color="#d93025"><b>${score}/100</b></font>`
                                    }
                                },
                                {
                                    textParagraph: {
                                        text: `<b>Reasoning:</b> ${reasoning}`
                                    }
                                }
                            ]
                        }
                    ]
                }
            }
        ]
    };

    try {
        await axios.post(webhookUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        console.log("Successfully dispatched emergency card to Google Chat.");
    } catch (error) {
        console.error("Failed to post to Google Chat:", error.message);
    }
}

module.exports = {
    sendEmergencyCard
};
