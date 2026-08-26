// ============================================
// YANTRA-X
// SERVER.JS
// Cloudflare Workers AI + Express
// ============================================

const express = require("express");
const path = require("path");
const dotenv = require("dotenv");

// Load .env
dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;

// ============================================
// CLOUDFLARE SETTINGS
// ============================================

const CLOUDFLARE_ACCOUNT_ID =
    process.env.CLOUDFLARE_ACCOUNT_ID;

const CLOUDFLARE_API_TOKEN =
    process.env.CLOUDFLARE_API_TOKEN;

// AI MODEL
// You can change this later if required.
const CLOUDFLARE_MODEL =
    process.env.CLOUDFLARE_MODEL ||
    "@cf/black-forest-labs/flux-1-schnell";


// ============================================
// CHECK CLOUDFLARE CONFIGURATION
// ============================================

if (!CLOUDFLARE_ACCOUNT_ID) {
    console.error(
        "❌ CLOUDFLARE_ACCOUNT_ID is missing in .env"
    );
}

if (!CLOUDFLARE_API_TOKEN) {
    console.error(
        "❌ CLOUDFLARE_API_TOKEN is missing in .env"
    );
}


// ============================================
// MIDDLEWARE
// ============================================

app.use(express.json({
    limit: "10mb"
}));

app.use(express.urlencoded({
    extended: true
}));


// ============================================
// SERVE FRONTEND
// ============================================

app.use(
    express.static(
        path.join(__dirname)
    )
);


// ============================================
// HOME PAGE
// ============================================

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "index.html"
        )
    );
});


// ============================================
// HEALTH CHECK
// ============================================

app.get("/api/health", (req, res) => {

    res.json({
        success: true,
        message: "Yantra-X server is running",
        cloudflareConfigured:
            Boolean(
                CLOUDFLARE_ACCOUNT_ID &&
                CLOUDFLARE_API_TOKEN
            ),
        model: CLOUDFLARE_MODEL
    });
});


// ============================================
// GENERATE IMAGE
// ============================================

app.post("/api/generate", async (req, res) => {

    try {

        console.log("\n================================");
        console.log("YANTRA-X IMAGE REQUEST");
        console.log("================================");

        // ----------------------------------------
        // GET DATA FROM FRONTEND
        // ----------------------------------------

        const {
            prompt,
            email
        } = req.body;


        console.log(
            "User:",
            email || "Guest"
        );

        console.log(
            "Prompt:",
            prompt
        );


        // ----------------------------------------
        // VALIDATE PROMPT
        // ----------------------------------------

        if (
            !prompt ||
            typeof prompt !== "string" ||
            prompt.trim().length === 0
        ) {

            return res.status(400).json({
                success: false,
                error: "Please enter a valid image prompt."
            });
        }


        // ----------------------------------------
        // VALIDATE CLOUDFLARE CONFIGURATION
        // ----------------------------------------

        if (!CLOUDFLARE_ACCOUNT_ID) {

            return res.status(500).json({
                success: false,
                error:
                    "Cloudflare Account ID is missing. Check your .env file."
            });
        }


        if (!CLOUDFLARE_API_TOKEN) {

            return res.status(500).json({
                success: false,
                error:
                    "Cloudflare API token is missing. Check your .env file."
            });
        }


        // ----------------------------------------
        // CLOUDFLARE AI URL
        // ----------------------------------------

        const cloudflareURL =
            `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${CLOUDFLARE_MODEL}`;


        console.log(
            "Cloudflare model:",
            CLOUDFLARE_MODEL
        );


        // ----------------------------------------
        // SEND PROMPT TO CLOUDFLARE
        // ----------------------------------------

        const cloudflareResponse =
            await fetch(
                cloudflareURL,
                {
                    method: "POST",

                    headers: {
                        "Authorization":
                            `Bearer ${CLOUDFLARE_API_TOKEN}`,

                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        prompt: prompt.trim()
                    })
                }
            );


        console.log(
            "Cloudflare status:",
            cloudflareResponse.status
        );


        // ----------------------------------------
        // HANDLE CLOUDFLARE ERROR
        // ----------------------------------------

        if (!cloudflareResponse.ok) {

            let errorMessage =
                "Cloudflare image generation failed.";

            try {

                const errorData =
                    await cloudflareResponse.json();

                console.error(
                    "Cloudflare error:",
                    errorData
                );

                if (
                    errorData &&
                    errorData.errors &&
                    errorData.errors.length > 0
                ) {

                    errorMessage =
                        errorData.errors
                            .map(
                                error =>
                                    error.message
                            )
                            .join(", ");
                }

                else if (
                    errorData &&
                    errorData.error
                ) {

                    errorMessage =
                        errorData.error;
                }

            } catch (jsonError) {

                const text =
                    await cloudflareResponse.text();

                console.error(
                    "Cloudflare raw error:",
                    text
                );

                if (text) {
                    errorMessage = text;
                }
            }


            return res.status(
                cloudflareResponse.status
            ).json({

                success: false,

                error: errorMessage
            });
        }


        // ========================================
        // GET GENERATED IMAGE
        // ========================================

        const contentType =
            cloudflareResponse.headers.get(
                "content-type"
            ) || "";


        console.log(
            "Response type:",
            contentType
        );


        // ----------------------------------------
        // CASE 1: CLOUDFLARE RETURNS IMAGE BINARY
        // ----------------------------------------

        if (
            contentType.startsWith(
                "image/"
            )
        ) {

            const imageBuffer =
                Buffer.from(
                    await cloudflareResponse.arrayBuffer()
                );


            const base64Image =
                imageBuffer.toString(
                    "base64"
                );


            const imageData =
                `data:${contentType};base64,${base64Image}`;


            console.log(
                "✅ Image generated successfully."
            );


            return res.json({

                success: true,

                image: imageData,

                prompt: prompt.trim(),

                email: email || null
            });
        }


        // ----------------------------------------
        // CASE 2: CLOUDFLARE RETURNS JSON
        // ----------------------------------------

        const result =
            await cloudflareResponse.json();


        console.log(
            "Cloudflare JSON response received."
        );


        // ----------------------------------------
        // FIND IMAGE DATA
        // ----------------------------------------

        let imageData = null;


        // Common Cloudflare response formats
        if (
            result &&
            result.result
        ) {

            const cloudflareResult =
                result.result;


            // result.image
            if (
                typeof cloudflareResult.image ===
                "string"
            ) {

                imageData =
                    cloudflareResult.image;
            }


            // result.base64
            else if (
                typeof cloudflareResult.base64 ===
                "string"
            ) {

                imageData =
                    cloudflareResult.base64;
            }


            // result.data
            else if (
                typeof cloudflareResult.data ===
                "string"
            ) {

                imageData =
                    cloudflareResult.data;
            }
        }


        // ----------------------------------------
        // IF IMAGE IS FOUND
        // ----------------------------------------

        if (imageData) {

            // If already a data URL
            if (
                imageData.startsWith(
                    "data:image/"
                )
            ) {

                return res.json({

                    success: true,

                    image: imageData,

                    prompt: prompt.trim(),

                    email: email || null
                });
            }


            // Otherwise assume base64 PNG
            if (
                !imageData.startsWith(
                    "http://"
                ) &&
                !imageData.startsWith(
                    "https://"
                )
            ) {

                imageData =
                    `data:image/png;base64,${imageData}`;
            }


            console.log(
                "✅ Image received from Cloudflare."
            );


            return res.json({

                success: true,

                image: imageData,

                prompt: prompt.trim(),

                email: email || null
            });
        }


        // ----------------------------------------
        // IMAGE NOT FOUND
        // ----------------------------------------

        console.error(
            "Cloudflare response did not contain image data:"
        );

        console.error(result);


        return res.status(500).json({

            success: false,

            error:
                "Cloudflare returned a response, but no image was found."
        });


    } catch (error) {

        // ========================================
        // GENERAL ERROR HANDLING
        // ========================================

        console.error(
            "\n❌ YANTRA-X SERVER ERROR"
        );

        console.error(
            error
        );


        return res.status(500).json({

            success: false,

            error:
                error.message ||
                "Internal server error."
        });
    }
});


// ============================================
// 404 API HANDLER
// ============================================

app.use("/api", (req, res) => {

    res.status(404).json({

        success: false,

        error:
            "API endpoint not found."
    });
});


// ============================================
// START SERVER
// ============================================

app.listen(
    PORT,
    () => {

        console.log(
            "\n=============================================="
        );

        console.log(
            "        YANTRA-X SERVER STARTED"
        );

        console.log(
            "=============================================="
        );

        console.log(
            `Open: http://localhost:${PORT}`
        );

        console.log(
            `Model: ${CLOUDFLARE_MODEL}`
        );

        console.log(
            `Cloudflare Account ID: ${
                CLOUDFLARE_ACCOUNT_ID
                    ? "✓ Loaded"
                    : "❌ Missing"
            }`
        );

        console.log(
            `Cloudflare API Token: ${
                CLOUDFLARE_API_TOKEN
                    ? "✓ Loaded"
                    : "❌ Missing"
            }`
        );

        console.log(
            "==============================================\n"
        );
    }
);