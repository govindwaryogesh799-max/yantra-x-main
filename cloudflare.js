// cloudflare.js
// Yantra-X - Cloudflare Workers AI image generation
// Model: FLUX.2 Klein 4B
//
// IMPORTANT:
// - AI generation is used only when the server decides the prompt is an AI request.
// - No automatic internet/reference-image lookup happens here.
// - A reference image is used ONLY when the user uploads one.
// - Every generation gets a random seed so repeated prompts can produce different results.

require("dotenv").config();

const crypto = require("crypto");
const sharp = require("sharp");

const DEFAULT_MODEL =
    process.env.CLOUDFLARE_MODEL ||
    "@cf/black-forest-labs/flux-2-klein-4b";

function createRandomSeed() {
    return crypto.randomInt(0, 2147483647);
}

/**
 * Small prompt variations help repeated identical prompts
 * produce different compositions.
 */
const SCENES = [
    "natural realistic composition",
    "cinematic composition",
    "professional photography composition",
    "documentary photography composition",
    "dynamic realistic composition",
    "detailed environmental composition",
    "natural candid composition",
    "high-end editorial photography composition"
];

const LIGHTING = [
    "natural daylight",
    "soft daylight",
    "cinematic lighting",
    "realistic ambient lighting",
    "soft studio lighting",
    "dramatic but realistic lighting",
    "golden hour lighting",
    "balanced professional lighting"
];

function randomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Convert an uploaded image into a small JPEG suitable
 * for the Cloudflare model.
 */
async function prepareReferenceImage(referenceImage) {
    if (!referenceImage) {
        return null;
    }

    let inputBuffer;

    if (Buffer.isBuffer(referenceImage)) {
        inputBuffer = referenceImage;
    } else if (typeof referenceImage === "string") {
        // Supports:
        // data:image/jpeg;base64,...
        // data:image/png;base64,...
        // or plain base64
        let base64 = referenceImage;

        if (base64.includes(",")) {
            base64 = base64.split(",")[1];
        }

        inputBuffer = Buffer.from(base64, "base64");
    } else {
        throw new Error("Invalid reference image");
    }

    // Keep the reference under the model's input-size requirement.
    return await sharp(inputBuffer)
        .rotate()
        .resize({
            width: 511,
            height: 511,
            fit: "inside",
            withoutEnlargement: true
        })
        .jpeg({
            quality: 88
        })
        .toBuffer();
}

/**
 * Generate an image using Cloudflare Workers AI.
 *
 * options:
 * {
 *   width: 512,
 *   height: 512,
 *   referenceImage: base64/data URL/Buffer
 * }
 */
async function generateCloudflareImage(prompt, options = {}) {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken =
        process.env.CLOUDFLARE_API_TOKEN ||
        process.env.CLOUDFLARE_API_KEY;

    if (!accountId) {
        throw new Error(
            "CLOUDFLARE_ACCOUNT_ID is missing from .env"
        );
    }

    if (!apiToken) {
        throw new Error(
            "CLOUDFLARE_API_TOKEN is missing from .env"
        );
    }

    if (!prompt || !String(prompt).trim()) {
        throw new Error("Prompt is required");
    }

    const width = Number(options.width) || 512;
    const height = Number(options.height) || 512;

    // A completely new seed is generated for every request.
    const seed = createRandomSeed();

    const scene = randomItem(SCENES);
    const lighting = randomItem(LIGHTING);

    const cleanPrompt = String(prompt).trim();

    let finalPrompt = `
${cleanPrompt}

Create a highly realistic image.
Use realistic proportions, natural textures, believable materials,
accurate lighting, realistic shadows and photographic detail.

${scene}.
${lighting}.

Avoid cartoon styling, illustration styling, anime styling,
plastic-looking surfaces, artificial-looking faces,
unnecessary text, watermarks and logos.

Make the result visually different from previous generations
when the same prompt is used.
`.trim();

    const referenceBuffer = await prepareReferenceImage(
        options.referenceImage
    );

    const usedReference = Boolean(referenceBuffer);

    if (usedReference) {
        finalPrompt = `
${cleanPrompt}

Use the uploaded reference image as the PRIMARY visual reference
for the subject.

Preserve the important identity, appearance, shape, proportions,
colors and distinctive characteristics of the referenced subject
while creating the requested scene.

Create a highly realistic photographic result.
Use realistic proportions, natural textures, believable materials,
accurate lighting and realistic shadows.

${scene}.
${lighting}.

Do not replace the referenced subject with a completely different
person, animal or object.
`.trim();
    }

    const url =
        `https://api.cloudflare.com/client/v4/accounts/` +
        `${accountId}/ai/run/${DEFAULT_MODEL}`;

    const form = new FormData();

    form.append(
        "prompt",
        finalPrompt
    );

    form.append(
        "seed",
        String(seed)
    );

    form.append(
        "width",
        String(width)
    );

    form.append(
        "height",
        String(height)
    );

    // IMPORTANT:
    // Only an image explicitly uploaded by the user is attached.
    if (referenceBuffer) {
        const blob = new Blob(
            [referenceBuffer],
            { type: "image/jpeg" }
        );

        form.append(
            "input_image_0",
            blob,
            "reference.jpg"
        );
    }

    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiToken}`
        },
        body: form
    });

    const contentType =
        response.headers.get("content-type") || "";

    if (!response.ok) {
        let errorText = "";

        try {
            errorText = await response.text();
        } catch (_) {
            errorText = "";
        }

        throw new Error(
            `Cloudflare AI request failed (${response.status}): ${errorText}`
        );
    }

    let imageBuffer;

    if (contentType.includes("application/json")) {
        const json = await response.json();

        /*
         * Cloudflare can return an image encoded in JSON
         * depending on the endpoint/version.
         */
        if (json.result) {
            if (json.result.image) {
                imageBuffer = Buffer.from(
                    json.result.image,
                    "base64"
                );
            } else if (json.result.data) {
                imageBuffer = Buffer.from(
                    json.result.data,
                    "base64"
                );
            }
        }

        if (!imageBuffer) {
            throw new Error(
                "Cloudflare returned JSON but no image was found: " +
                JSON.stringify(json)
            );
        }
    } else {
        // Normal binary image response.
        const arrayBuffer = await response.arrayBuffer();

        imageBuffer = Buffer.from(arrayBuffer);
    }

    if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error(
            "Cloudflare returned an empty image."
        );
    }

    return {
        image: imageBuffer.toString("base64"),

        mimeType:
            contentType &&
            contentType.startsWith("image/")
                ? contentType.split(";")[0]
                : "image/jpeg",

        seed,

        model: DEFAULT_MODEL,

        usedReference,

        automaticReference: false
    };
}

module.exports = {
    generateCloudflareImage
};