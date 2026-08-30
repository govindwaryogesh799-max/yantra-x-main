require("dotenv").config();

async function generateCloudflareImage(prompt) {

    if (!prompt || !prompt.trim()) {
        throw new Error("Prompt is required.");
    }

    const accountId =
        process.env.CLOUDFLARE_ACCOUNT_ID;

    const apiToken =
        process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId) {
        throw new Error(
            "CLOUDFLARE_ACCOUNT_ID is missing in .env"
        );
    }

    if (!apiToken) {
        throw new Error(
            "CLOUDFLARE_API_TOKEN is missing in .env"
        );
    }

    const model =
        "@cf/black-forest-labs/flux-1-schnell";

    const url =
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

    const response =
        await fetch(
            url,
            {
                method: "POST",

                headers: {
                    "Authorization":
                        `Bearer ${apiToken}`,

                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    prompt:
                        prompt.trim(),

                    steps: 4

                })
            }
        );

    const contentType =
        response.headers.get(
            "content-type"
        ) || "";


    // Cloudflare returned image directly
    if (
        contentType.startsWith("image/")
    ) {

        const buffer =
            Buffer.from(
                await response.arrayBuffer()
            );

        return (
            `data:${contentType};base64,` +
            buffer.toString("base64")
        );
    }


    let data;

    try {

        data =
            await response.json();

    } catch {

        throw new Error(
            "Cloudflare returned an invalid response."
        );
    }


    if (
        !response.ok ||
        data.success === false
    ) {

        console.error(
            "Cloudflare API error:",
            data
        );

        const message =
            data?.errors
                ?.map(
                    e => e.message
                )
                .join(", ") ||
            "Cloudflare image generation failed.";

        throw new Error(message);
    }


    if (
        data?.result?.image
    ) {

        return (
            "data:image/jpeg;base64," +
            data.result.image
        );
    }


    if (
        data?.result?.images &&
        data.result.images[0]
    ) {

        return (
            "data:image/jpeg;base64," +
            data.result.images[0]
        );
    }


    console.error(
        "Unexpected Cloudflare response:",
        data
    );

    throw new Error(
        "Cloudflare did not return an image."
    );
}


module.exports = {
    generateCloudflareImage
};