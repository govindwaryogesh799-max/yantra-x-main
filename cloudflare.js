require("dotenv").config();

async function generateCloudflareImage(prompt) {
    if (!prompt || !prompt.trim()) {
        throw new Error("Prompt is required");
    }

    if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
        throw new Error("CLOUDFLARE_ACCOUNT_ID is missing in .env");
    }

    if (!process.env.CLOUDFLARE_API_TOKEN) {
        throw new Error("CLOUDFLARE_API_TOKEN is missing in .env");
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    const model = "@cf/black-forest-labs/flux-1-schnell";

    const url =
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            prompt: prompt.trim(),
            steps: 4
        })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
        console.error("Cloudflare API error:", data);

        const message =
            data?.errors?.map(e => e.message).join(", ") ||
            "Cloudflare image generation failed";

        throw new Error(message);
    }

    if (!data.result || !data.result.image) {
        console.error("Unexpected Cloudflare response:", data);
        throw new Error("Cloudflare did not return an image");
    }

    return `data:image/jpeg;base64,${data.result.image}`;
}

module.exports = {
    generateCloudflareImage
};