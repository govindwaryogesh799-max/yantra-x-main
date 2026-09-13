"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const {
    generateCloudflareImage
} = require("./cloudflare");

const app = express();

const PORT =
    Number(process.env.PORT) || 3000;

const ROOT =
    __dirname;

const PUBLIC =
    path.join(
        ROOT,
        "public"
    );

const DATA =
    path.join(
        ROOT,
        "data"
    );

const GENERATED =
    path.join(
        ROOT,
        "generated"
    );

const USERS =
    path.join(
        DATA,
        "users.json"
    );

const SESSIONS =
    path.join(
        DATA,
        "sessions.json"
    );

const HISTORY =
    path.join(
        DATA,
        "history.json"
    );

/* =====================================================
   SETUP
===================================================== */

fs.mkdirSync(
    DATA,
    {
        recursive: true
    }
);

fs.mkdirSync(
    GENERATED,
    {
        recursive: true
    }
);

function createFile(
    file,
    value
) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(
            file,
            JSON.stringify(
                value,
                null,
                2
            ),
            "utf8"
        );
    }
}

createFile(
    USERS,
    []
);

createFile(
    SESSIONS,
    []
);

createFile(
    HISTORY,
    []
);

/* =====================================================
   JSON DATABASE
===================================================== */

function readJSON(
    file,
    fallback = []
) {
    try {
        return JSON.parse(
            fs.readFileSync(
                file,
                "utf8"
            )
        );
    } catch {
        return fallback;
    }
}

function writeJSON(
    file,
    data
) {
    fs.writeFileSync(
        file,
        JSON.stringify(
            data,
            null,
            2
        ),
        "utf8"
    );
}

/* =====================================================
   PASSWORD
===================================================== */

function hashPassword(
    password
) {
    const salt =
        crypto
            .randomBytes(16)
            .toString("hex");

    const hash =
        crypto
            .scryptSync(
                String(password),
                salt,
                64
            )
            .toString("hex");

    return (
        `scrypt:${salt}:${hash}`
    );
}

function verifyPassword(
    password,
    stored
) {
    if (!stored) {
        return false;
    }

    if (
        stored.startsWith(
            "scrypt:"
        )
    ) {
        const parts =
            stored.split(":");

        if (
            parts.length !== 3
        ) {
            return false;
        }

        const salt =
            parts[1];

        const oldHash =
            parts[2];

        const hash =
            crypto
                .scryptSync(
                    String(password),
                    salt,
                    64
                )
                .toString("hex");

        return (
            hash === oldHash
        );
    }

    const old =
        crypto
            .createHash(
                "sha256"
            )
            .update(
                String(password)
            )
            .digest("hex");

    return (
        old === stored
    );
}

/* =====================================================
   TOKEN
===================================================== */

function createToken() {
    return crypto
        .randomBytes(32)
        .toString("hex");
}

/* =====================================================
   INPUT
===================================================== */

function cleanPrompt(
    value
) {
    return String(
        value || ""
    )
        .replace(
            /\s+/g,
            " "
        )
        .trim()
        .slice(
            0,
            4000
        );
}

/*
 * AI MODE:
 *
 * "AI futuristic car"
 *
 * REAL IMAGE MODE:
 *
 * "Dhoni"
 * "Lion"
 * "Taj Mahal"
 * "BMW M5"
 */

function isAIRequest(
    prompt
) {
    return /\bai\b/i.test(
        String(prompt || "")
    );
}

function removeAIKeyword(
    prompt
) {
    return String(
        prompt || ""
    )
        .replace(
            /\bai\b/gi,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}

/* =====================================================
   REFERENCE IMAGE
===================================================== */

function parseDataUrl(
    dataUrl
) {
    if (!dataUrl) {
        return null;
    }

    if (
        typeof dataUrl !==
        "string"
    ) {
        throw new Error(
            "Invalid reference image."
        );
    }

    const match =
        dataUrl.match(
            /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/i
        );

    if (!match) {
        throw new Error(
            "Reference image must be PNG, JPG, JPEG, or WEBP."
        );
    }

    let mimeType =
        match[1].toLowerCase();

    if (
        mimeType ===
        "image/jpg"
    ) {
        mimeType =
            "image/jpeg";
    }

    const buffer =
        Buffer.from(
            match[2].replace(
                /\s/g,
                ""
            ),
            "base64"
        );

    if (!buffer.length) {
        throw new Error(
            "Reference image is empty."
        );
    }

    if (
        buffer.length >
        8 * 1024 * 1024
    ) {
        throw new Error(
            "Reference image is too large. Maximum size is 8 MB."
        );
    }

    return {
        mimeType,
        buffer
    };
}

/* =====================================================
   MIME
===================================================== */

function extensionFromMime(
    mimeType
) {
    const mime =
        String(
            mimeType || ""
        ).toLowerCase();

    if (
        mime.includes("jpeg") ||
        mime.includes("jpg")
    ) {
        return "jpg";
    }

    if (
        mime.includes("webp")
    ) {
        return "webp";
    }

    if (
        mime.includes("gif")
    ) {
        return "gif";
    }

    if (
        mime.includes("avif")
    ) {
        return "avif";
    }

    return "png";
}

/* =====================================================
   SAVE IMAGE BUFFER
===================================================== */

function saveBufferAsImage(
    buffer,
    mimeType = "image/jpeg"
) {
    if (
        !Buffer.isBuffer(buffer) ||
        !buffer.length
    ) {
        throw new Error(
            "Image data is empty."
        );
    }

    const extension =
        extensionFromMime(
            mimeType
        );

    const filename =
        `${Date.now()}-${crypto
            .randomBytes(8)
            .toString("hex")}.${extension}`;

    const filePath =
        path.join(
            GENERATED,
            filename
        );

    fs.writeFileSync(
        filePath,
        buffer
    );

    return (
        `/generated/${filename}`
    );
}

/* =====================================================
   SAVE CLOUDFLARE BASE64 IMAGE
===================================================== */

function persistBase64Image(
    image,
    mimeType = "image/png"
) {
    if (!image) {
        throw new Error(
            "Cloudflare returned no image."
        );
    }

    let base64 =
        String(image);

    if (
        base64.startsWith(
            "data:"
        )
    ) {
        const comma =
            base64.indexOf(",");

        if (
            comma !== -1
        ) {
            base64 =
                base64.substring(
                    comma + 1
                );
        }
    }

    base64 =
        base64.replace(
            /\s/g,
            ""
        );

    const buffer =
        Buffer.from(
            base64,
            "base64"
        );

    if (!buffer.length) {
        throw new Error(
            "Generated image is empty."
        );
    }

    return saveBufferAsImage(
        buffer,
        mimeType
    );
}

/* =====================================================
   DOWNLOAD REAL INTERNET IMAGE
===================================================== */

async function downloadRealImage(
    url
) {
    if (
        !url ||
        !/^https?:\/\//i.test(
            url
        )
    ) {
        throw new Error(
            "Invalid image URL."
        );
    }

    const controller =
        new AbortController();

    const timeout =
        setTimeout(
            () => controller.abort(),
            12000
        );

    try {
        const response =
            await fetch(
                url,
                {
                    method: "GET",
                    redirect: "follow",
                    signal:
                        controller.signal,

                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36",

                        "Accept":
                            "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
                    }
                }
            );

        if (!response.ok) {
            throw new Error(
                `Image server returned ${response.status}.`
            );
        }

        const contentType =
            String(
                response.headers.get(
                    "content-type"
                ) || ""
            ).toLowerCase();

        if (
            !contentType.startsWith(
                "image/"
            )
        ) {
            throw new Error(
                "URL did not return an image."
            );
        }

        const contentLength =
            Number(
                response.headers.get(
                    "content-length"
                )
            ) || 0;

        if (
            contentLength >
            15 * 1024 * 1024
        ) {
            throw new Error(
                "Image is larger than 15 MB."
            );
        }

        const arrayBuffer =
            await response.arrayBuffer();

        const buffer =
            Buffer.from(
                arrayBuffer
            );

        if (!buffer.length) {
            throw new Error(
                "Downloaded image is empty."
            );
        }

        if (
            buffer.length >
            15 * 1024 * 1024
        ) {
            throw new Error(
                "Downloaded image is larger than 15 MB."
            );
        }

        return {
            buffer,

            mimeType:
                contentType
                    .split(";")[0]
                    .trim()
        };
    } finally {
        clearTimeout(
            timeout
        );
    }
}

/* =====================================================
   REAL IMAGE SEARCH
===================================================== */

async function searchRealImage(
    query
) {
    const key =
        process.env.SERPAPI_KEY;

    if (!key) {
        throw new Error(
            "SERPAPI_KEY is not configured."
        );
    }

    const url =
        new URL(
            "https://serpapi.com/search.json"
        );

    url.searchParams.set(
        "engine",
        "google_images"
    );

    url.searchParams.set(
        "q",
        query
    );

    url.searchParams.set(
        "api_key",
        key
    );

    url.searchParams.set(
        "hl",
        "en"
    );

    url.searchParams.set(
        "gl",
        "in"
    );

    /*
     * Ask Google Images for
     * photographic results.
     */
    url.searchParams.set(
        "image_type",
        "photo"
    );

    url.searchParams.set(
        "safe",
        "active"
    );

    const response =
        await fetch(
            url,
            {
                headers: {
                    "User-Agent":
                        "Yantra-X/1.0"
                }
            }
        );

    const data =
        await response.json();

    if (!response.ok) {
        throw new Error(
            data?.error ||
            "Google Images search failed."
        );
    }

    const results =
        Array.isArray(
            data.images_results
        )
            ? data.images_results
            : [];

    if (!results.length) {
        throw new Error(
            `No real image found for "${query}".`
        );
    }

    /*
     * Try multiple results.
     *
     * Some image websites block
     * server-side downloading.
     */
    const usable =
        results
            .filter(
                item =>
                    item &&
                    (
                        item.original ||
                        item.thumbnail
                    )
            )
            .slice(
                0,
                12
            );

    let lastError =
        null;

    for (
        const item
        of usable
    ) {
        const imageUrl =
            item.original ||
            item.thumbnail;

        try {
            const downloaded =
                await downloadRealImage(
                    imageUrl
                );

            const localImage =
                saveBufferAsImage(
                    downloaded.buffer,
                    downloaded.mimeType
                );

            return {
                image:
                    localImage,

                imageUrl:
                    localImage,

                originalUrl:
                    imageUrl,

                thumbnail:
                    item.thumbnail ||
                    imageUrl,

                title:
                    item.title ||
                    query,

                source:
                    item.source ||
                    "",

                sourceUrl:
                    item.link ||
                    "",

                originalWidth:
                    item.original_width ||
                    null,

                originalHeight:
                    item.original_height ||
                    null
            };
        } catch (error) {
            lastError =
                error;

            console.log(
                `[YANTRA-X] Real image download failed. Trying next result: ${error.message}`
            );
        }
    }

    throw new Error(
        `Google found images, but Yantra-X could not download a usable real image. ${
            lastError
                ? lastError.message
                : ""
        }`
    );
}

/* =====================================================
   HISTORY
===================================================== */

function saveHistory(
    userId,
    prompt,
    imageUrl,
    type,
    seed,
    model,
    extra = {}
) {
    const history =
        readJSON(
            HISTORY,
            []
        );

    const item = {
        id:
            crypto.randomUUID(),

        userId,

        prompt,

        image:
            imageUrl,

        imageUrl,

        type,

        seed:
            seed ?? null,

        model:
            model ?? null,

        createdAt:
            new Date()
                .toISOString(),

        ...extra
    };

    history.unshift(
        item
    );

    if (
        history.length >
        1000
    ) {
        history.length =
            1000;
    }

    writeJSON(
        HISTORY,
        history
    );

    return item;
}

/* =====================================================
   MIDDLEWARE
===================================================== */

app.use(
    cors({
        origin:
            process.env.CORS_ORIGIN ||
            true,

        credentials:
            true
    })
);

app.use(
    express.json({
        limit:
            "15mb"
    })
);

app.use(
    express.urlencoded({
        extended:
            true,

        limit:
            "15mb"
    })
);

app.use(
    express.static(
        PUBLIC
    )
);

app.use(
    "/generated",
    express.static(
        GENERATED,
        {
            maxAge: 0,
            etag: false,
            cacheControl: false
        }
    )
);

/* =====================================================
   AUTH HELPERS
===================================================== */

function getToken(
    req
) {
    const auth =
        req.headers.authorization;

    if (
        auth &&
        auth.startsWith(
            "Bearer "
        )
    ) {
        return auth
            .substring(7)
            .trim();
    }

    return null;
}

function currentUser(
    req
) {
    const token =
        getToken(req);

    if (!token) {
        return null;
    }

    const sessions =
        readJSON(
            SESSIONS,
            []
        );

    const users =
        readJSON(
            USERS,
            []
        );

    const session =
        sessions.find(
            s =>
                s &&
                s.token ===
                    token
        );

    if (!session) {
        return null;
    }

    const user =
        users.find(
            u =>
                u &&
                u.id ===
                    session.userId
        );

    if (!user) {
        return null;
    }

    return {
        user,
        token
    };
}

function auth(
    req,
    res,
    next
) {
    const result =
        currentUser(req);

    if (!result) {
        return res
            .status(401)
            .json({
                success:
                    false,

                message:
                    "Please login first."
            });
    }

    req.user =
        result.user;

    req.token =
        result.token;

    next();
}

const requireAuth =
    auth;

/* =====================================================
   HEALTH
===================================================== */

app.get(
    "/api/health",
    (req, res) => {
        res.json({
            success:
                true,

            message:
                "Yantra-X server is running.",

            model:
                process.env
                    .CLOUDFLARE_MODEL ||
                "@cf/black-forest-labs/flux-2-klein-4b",

            cloudflareConfigured:
                Boolean(
                    process.env
                        .CLOUDFLARE_ACCOUNT_ID &&
                    process.env
                        .CLOUDFLARE_API_TOKEN
                ),

            serpApiConfigured:
                Boolean(
                    process.env
                        .SERPAPI_KEY
                ),

            realImageMode:
                "Google Images -> server download -> local image"
        });
    }
);

/* =====================================================
   SIGNUP
===================================================== */

app.post(
    "/api/auth/signup",
    (req, res) => {
        try {
            const {
                name,
                username,
                email,
                password
            } =
                req.body || {};

            const cleanName =
                String(
                    name || ""
                ).trim();

            const cleanUsername =
                String(
                    username || ""
                ).trim();

            const cleanEmail =
                String(
                    email || ""
                )
                    .trim()
                    .toLowerCase();

            if (
                !cleanName ||
                !cleanUsername ||
                !cleanEmail
            ) {
                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "All fields are required."
                    });
            }

            if (
                String(
                    password || ""
                ).length < 6
            ) {
                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Password must be at least 6 characters."
                    });
            }

            const users =
                readJSON(
                    USERS,
                    []
                );

            const exists =
                users.some(
                    u =>
                        String(
                            u.email || ""
                        ).toLowerCase() ===
                            cleanEmail ||
                        String(
                            u.username || ""
                        ).toLowerCase() ===
                            cleanUsername
                                .toLowerCase()
                );

            if (exists) {
                return res
                    .status(409)
                    .json({
                        success:
                            false,

                        message:
                            "Username or email already exists."
                    });
            }

            const user = {
                id:
                    crypto.randomUUID(),

                name:
                    cleanName,

                username:
                    cleanUsername,

                email:
                    cleanEmail,

                password:
                    hashPassword(
                        String(
                            password
                        )
                    ),

                createdAt:
                    new Date()
                        .toISOString()
            };

            users.push(
                user
            );

            writeJSON(
                USERS,
                users
            );

            const token =
                createToken();

            const sessions =
                readJSON(
                    SESSIONS,
                    []
                );

            sessions.push({
                token,

                userId:
                    user.id,

                createdAt:
                    new Date()
                        .toISOString()
            });

            writeJSON(
                SESSIONS,
                sessions
            );

            res.json({
                success:
                    true,

                token,

                user: {
                    id:
                        user.id,

                    name:
                        user.name,

                    username:
                        user.username,

                    email:
                        user.email
                }
            });
        } catch (error) {
            console.error(
                "[YANTRA-X] Signup:",
                error
            );

            res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Signup failed."
                });
        }
    }
);

/* =====================================================
   LOGIN
===================================================== */

app.post(
    "/api/auth/login",
    (req, res) => {
        try {
            const {
                email,
                username,
                password
            } =
                req.body || {};

            const identifier =
                String(
                    email ||
                    username ||
                    ""
                )
                    .trim()
                    .toLowerCase();

            if (
                !identifier ||
                !password
            ) {
                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Email/username and password are required."
                    });
            }

            const users =
                readJSON(
                    USERS,
                    []
                );

            const user =
                users.find(
                    u =>
                        String(
                            u.email || ""
                        ).toLowerCase() ===
                            identifier ||
                        String(
                            u.username || ""
                        ).toLowerCase() ===
                            identifier
                );

            if (
                !user ||
                !verifyPassword(
                    String(password),
                    user.password
                )
            ) {
                return res
                    .status(401)
                    .json({
                        success:
                            false,

                        message:
                            "Invalid login details."
                    });
            }

            const token =
                createToken();

            const sessions =
                readJSON(
                    SESSIONS,
                    []
                );

            sessions.push({
                token,

                userId:
                    user.id,

                createdAt:
                    new Date()
                        .toISOString()
            });

            writeJSON(
                SESSIONS,
                sessions
            );

            res.json({
                success:
                    true,

                token,

                user: {
                    id:
                        user.id,

                    name:
                        user.name,

                    username:
                        user.username,

                    email:
                        user.email
                }
            });
        } catch (error) {
            console.error(
                "[YANTRA-X] Login:",
                error
            );

            res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Login failed."
                });
        }
    }
);
/* =====================================================
   ME
===================================================== */

app.get(
    "/api/auth/me",
    auth,
    (req, res) => {
        res.json({
            success:
                true,

            user: {
                id:
                    req.user.id,

                name:
                    req.user.name,

                username:
                    req.user.username,

                email:
                    req.user.email
            }
        });
    }
);

/* =====================================================
   LOGOUT
===================================================== */

app.post(
    "/api/auth/logout",
    auth,
    (req, res) => {
        let sessions =
            readJSON(
                SESSIONS,
                []
            );

        sessions =
            sessions.filter(
                s =>
                    s.token !==
                    req.token
            );

        writeJSON(
            SESSIONS,
            sessions
        );

        res.json({
            success:
                true
        });
    }
);

/* =====================================================
   GENERATE / REAL IMAGE SEARCH
===================================================== */

app.post(
    "/api/generate",
    requireAuth,
    async (
        req,
        res
    ) => {
        const startedAt =
            Date.now();

        try {
            const prompt =
                cleanPrompt(
                    req.body?.prompt
                );

            if (!prompt) {
                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Please enter an image prompt."
                    });
            }

            const reference =
                parseDataUrl(
                    req.body
                        ?.referenceImage
                );

            const width =
                Number(
                    req.body?.width
                ) || 768;

            const height =
                Number(
                    req.body?.height
                ) || 768;

            console.log(
                `[YANTRA-X] User: ${req.user.username}`
            );

            console.log(
                `[YANTRA-X] Prompt: ${prompt}`
            );

            console.log(
                `[YANTRA-X] Uploaded reference: ${Boolean(reference)}`
            );

            /* =================================================
               AI MODE

               Example:

               AI futuristic sports car
               AI lion in forest

               Cloudflare creates a NEW image.
            ================================================= */

            if (
                isAIRequest(
                    prompt
                )
            ) {
                const aiPrompt =
                    removeAIKeyword(
                        prompt
                    );

                if (!aiPrompt) {
                    return res
                        .status(400)
                        .json({
                            success:
                                false,

                            message:
                                "After AI, please describe the image you want."
                        });
                }

                const result =
                    await generateCloudflareImage(
                        aiPrompt,
                        {
                            width,
                            height,

                            referenceImage:
                                reference,

                            autoReference:
                                false
                        }
                    );

                const localImage =
                    persistBase64Image(
                        result.image,
                        result.mimeType
                    );

                const generationTime =
                    Date.now() -
                    startedAt;

                const historyItem =
                    saveHistory(
                        req.user.id,
                        prompt,
                        localImage,
                        reference
                            ? "reference-generated"
                            : "generated",
                        result.seed,
                        result.model,
                        {
                            usedReference:
                                result.usedReference ||
                                false,

                            automaticReference:
                                false
                        }
                    );

                console.log(
                    `[YANTRA-X] AI completed in ${generationTime}ms`
                );

                return res.json({
                    success:
                        true,

                    type:
                        "ai",

                    image:
                        localImage,

                    imageUrl:
                        localImage,

                    seed:
                        result.seed,

                    model:
                        result.model,

                    prompt,

                    generationPrompt:
                        aiPrompt,

                    usedReference:
                        result.usedReference ||
                        false,

                    automaticReference:
                        false,

                    generationTime,

                    history:
                        historyItem
                });
            }

            /* =================================================
               REAL IMAGE MODE

               Examples:

               Dhoni
               Lion
               Taj Mahal
               BMW M5
               Virat Kohli

               These use existing images from Google Images.

               The server downloads the image and stores it
               locally before returning it to the frontend.
            ================================================= */

            const realImage =
                await searchRealImage(
                    prompt
                );

            const generationTime =
                Date.now() -
                startedAt;

            const historyItem =
                saveHistory(
                    req.user.id,

                    prompt,

                    realImage.imageUrl,

                    "real",

                    null,

                    "Google Images",

                    {
                        title:
                            realImage.title,

                        source:
                            realImage.source,

                        sourceUrl:
                            realImage.sourceUrl,

                        originalUrl:
                            realImage.originalUrl,

                        originalWidth:
                            realImage.originalWidth,

                        originalHeight:
                            realImage.originalHeight
                    }
                );

            console.log(
                `[YANTRA-X] REAL image downloaded in ${generationTime}ms`
            );

            return res.json({
                success:
                    true,

                type:
                    "real",

                /*
                 * IMPORTANT:
                 *
                 * The frontend receives the LOCAL
                 * Yantra-X image URL.
                 */
                image:
                    realImage.imageUrl,

                imageUrl:
                    realImage.imageUrl,

                thumbnail:
                    realImage.thumbnail,

                title:
                    realImage.title,

                source:
                    realImage.source,

                sourceUrl:
                    realImage.sourceUrl,

                originalUrl:
                    realImage.originalUrl,

                originalWidth:
                    realImage.originalWidth,

                originalHeight:
                    realImage.originalHeight,

                prompt,

                generationTime,

                usedReference:
                    false,

                automaticReference:
                    false,

                history:
                    historyItem
            });
        } catch (error) {
            console.error(
                "[YANTRA-X] GENERATION ERROR:",
                error
            );

            const errorMessage =
                error?.name ===
                "AbortError"
                    ? "The image source took too long to respond. Please try again."
                    : error?.message ||
                      "Image generation/search failed.";

            res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        errorMessage
                });
        }
    }
);

/* =====================================================
   HISTORY
===================================================== */

app.get(
    "/api/history",
    auth,
    (req, res) => {
        const history =
            readJSON(
                HISTORY,
                []
            );

        const userHistory =
            Array.isArray(
                history
            )
                ? history.filter(
                    item =>
                        item.userId ===
                        req.user.id
                )
                : [];

        res.json({
            success:
                true,

            history:
                userHistory.slice(
                    0,
                    100
                )
        });
    }
);

/* =====================================================
   DELETE HISTORY ITEM
===================================================== */

app.delete(
    "/api/history/:id",
    auth,
    (req, res) => {
        const history =
            readJSON(
                HISTORY,
                []
            );

        const item =
            history.find(
                h =>
                    h.id ===
                        req.params.id &&
                    h.userId ===
                        req.user.id
            );

        if (
            item &&
            item.image
        ) {
            const relative =
                String(
                    item.image
                )
                    .replace(
                        /^\/generated\//,
                        ""
                    )
                    .replace(
                        /^\/+/,
                        ""
                    );

            const filePath =
                path.resolve(
                    GENERATED,
                    relative
                );

            const generatedRoot =
                path.resolve(
                    GENERATED
                ) + path.sep;

            if (
                filePath.startsWith(
                    generatedRoot
                ) &&
                fs.existsSync(
                    filePath
                )
            ) {
                try {
                    fs.unlinkSync(
                        filePath
                    );
                } catch {}
            }
        }

        const remaining =
            history.filter(
                h =>
                    !(
                        h.id ===
                            req.params.id &&
                        h.userId ===
                            req.user.id
                    )
            );

        writeJSON(
            HISTORY,
            remaining
        );

        res.json({
            success:
                true
        });
    }
);

/* =====================================================
   CLEAR HISTORY
===================================================== */

app.delete(
    "/api/history",
    auth,
    (req, res) => {
        const history =
            readJSON(
                HISTORY,
                []
            );

        for (
            const item
            of history
        ) {
            if (
                item.userId !==
                req.user.id
            ) {
                continue;
            }

            if (!item.image) {
                continue;
            }

            const relative =
                String(
                    item.image
                )
                    .replace(
                        /^\/generated\//,
                        ""
                    )
                    .replace(
                        /^\/+/,
                        ""
                    );

            const filePath =
                path.resolve(
                    GENERATED,
                    relative
                );

            const generatedRoot =
                path.resolve(
                    GENERATED
                ) + path.sep;

            if (
                filePath.startsWith(
                    generatedRoot
                ) &&
                fs.existsSync(
                    filePath
                )
            ) {
                try {
                    fs.unlinkSync(
                        filePath
                    );
                } catch {}
            }
        }

        const remaining =
            history.filter(
                item =>
                    item.userId !==
                    req.user.id
            );

        writeJSON(
            HISTORY,
            remaining
        );

        res.json({
            success:
                true
        });
    }
);

/* =====================================================
   SEARCH API
===================================================== */

app.get(
    "/api/search",
    auth,
    async (
        req,
        res
    ) => {
        try {
            const key =
                process.env
                    .SERPAPI_KEY;

            if (!key) {
                return res
                    .status(503)
                    .json({
                        success:
                            false,

                        message:
                            "SERPAPI_KEY is not configured."
                    });
            }

            const q =
                String(
                    req.query.q ||
                    ""
                ).trim();

            if (!q) {
                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Search query is required."
                    });
            }

            const url =
                new URL(
                    "https://serpapi.com/search.json"
                );

            url.searchParams.set(
                "engine",
                "google_images"
            );

            url.searchParams.set(
                "q",
                q
            );

            url.searchParams.set(
                "api_key",
                key
            );

            url.searchParams.set(
                "hl",
                "en"
            );

            url.searchParams.set(
                "gl",
                "in"
            );

            url.searchParams.set(
                "image_type",
                "photo"
            );

            url.searchParams.set(
                "safe",
                "active"
            );

            const response =
                await fetch(
                    url
                );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.error ||
                    "Search failed."
                );
            }

            res.json({
                success:
                    true,

                results:
                    data
                        .organic_results ||
                    [],

                images:
                    data
                        .images_results ||
                    []
            });
        } catch (error) {
            console.error(
                "[YANTRA-X] Search:",
                error
            );

            res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        error?.message ||
                        "Search failed."
                });
        }
    }
);
/* =====================================================
   FRONTEND
===================================================== */

app.get(
    "/",
    (req, res) => {
        res.sendFile(
            path.join(
                PUBLIC,
                "index.html"
            )
        );
    }
);

/* =====================================================
   API 404
===================================================== */

app.use(
    "/api",
    (req, res) => {
        res
            .status(404)
            .json({
                success:
                    false,

                message:
                    "API endpoint not found."
            });
    }
);

/* =====================================================
   ERROR HANDLER
===================================================== */

app.use(
    (
        error,
        req,
        res,
        next
    ) => {
        console.error(
            "[YANTRA-X] Server error:",
            error
        );

        if (
            res.headersSent
        ) {
            return next(
                error
            );
        }

        res
            .status(500)
            .json({
                success:
                    false,

                message:
                    error?.message ||
                    "Internal server error."
            });
    }
);

/* =====================================================
   START SERVER
===================================================== */

app.listen(
    PORT,
    () => {
        console.log(
            "\n================================="
        );

        console.log(
            "          YANTRA-X"
        );

        console.log(
            "================================="
        );

        console.log(
            `http://localhost:${PORT}`
        );

        console.log(
            "AI model:",
            process.env
                .CLOUDFLARE_MODEL ||
            "@cf/black-forest-labs/flux-2-klein-4b"
        );

        console.log(
            "Cloudflare configured:",
            Boolean(
                process.env
                    .CLOUDFLARE_ACCOUNT_ID &&
                process.env
                    .CLOUDFLARE_API_TOKEN
            )
        );

        console.log(
            "SerpApi configured:",
            Boolean(
                process.env
                    .SERPAPI_KEY
            )
        );

        console.log(
            "REAL IMAGE MODE:",
            "Google Images -> local download"
        );

        console.log(
            "=================================\n"
        );
    }
);