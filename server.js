require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const { generateCloudflareImage } = require("./cloudflare");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

const DATA_DIR = path.join(__dirname, "data");

const USERS_FILE = path.join(DATA_DIR, "users.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");


// ============================================================
// FILE SYSTEM
// ============================================================

function ensureData() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, "[]");
    }

    if (!fs.existsSync(SESSIONS_FILE)) {
        fs.writeFileSync(SESSIONS_FILE, "{}");
    }

    if (!fs.existsSync(HISTORY_FILE)) {
        fs.writeFileSync(HISTORY_FILE, "[]");
    }
}

ensureData();


function readJSON(file, fallback) {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        return fallback;
    }
}


function writeJSON(file, data) {
    fs.writeFileSync(
        file,
        JSON.stringify(data, null, 2)
    );
}


// ============================================================
// PASSWORD
// ============================================================

function hashPassword(password) {
    return crypto
        .createHash("sha256")
        .update(password)
        .digest("hex");
}


// ============================================================
// TOKEN
// ============================================================

function createToken() {
    return crypto.randomBytes(32).toString("hex");
}


// ============================================================
// AUTH MIDDLEWARE
// ============================================================

function getToken(req) {
    const auth = req.headers.authorization || "";

    if (auth.startsWith("Bearer ")) {
        return auth.substring(7).trim();
    }

    return null;
}


function getCurrentUser(req) {

    const token = getToken(req);

    if (!token) {
        return null;
    }

    const sessions = readJSON(
        SESSIONS_FILE,
        {}
    );

    const userId = sessions[token];

    if (!userId) {
        return null;
    }

    const users = readJSON(
        USERS_FILE,
        []
    );

    return users.find(
        user => user.id === userId
    ) || null;
}


function requireAuth(req, res, next) {

    const user = getCurrentUser(req);

    if (!user) {
        return res.status(401).json({
            success: false,
            message: "Please log in first."
        });
    }

    req.user = user;

    next();
}


// ============================================================
// REGISTER
// ============================================================

app.post("/api/register", (req, res) => {

    try {

        const name =
            String(req.body.name || "").trim();

        const email =
            String(req.body.email || "")
                .trim()
                .toLowerCase();

        const password =
            String(req.body.password || "");

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Name is required."
            });
        }

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 6 characters."
            });
        }

        const users =
            readJSON(USERS_FILE, []);

        const existing =
            users.find(
                user => user.email === email
            );

        if (existing) {

            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        const user = {

            id: crypto.randomUUID(),

            name,

            email,

            password: hashPassword(password),

            createdAt: new Date().toISOString()

        };

        users.push(user);

        writeJSON(
            USERS_FILE,
            users
        );

        // Automatically log the user in
        const token = createToken();

        const sessions =
            readJSON(
                SESSIONS_FILE,
                {}
            );

        sessions[token] = user.id;

        writeJSON(
            SESSIONS_FILE,
            sessions
        );

        return res.json({

            success: true,

            message: "Account created successfully.",

            token,

            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }

        });

    } catch (error) {

        console.error("REGISTER ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to create account."
        });
    }
});


// ============================================================
// LOGIN
// ============================================================

app.post("/api/login", (req, res) => {

    try {

        const email =
            String(req.body.email || "")
                .trim()
                .toLowerCase();

        const password =
            String(req.body.password || "");

        const users =
            readJSON(
                USERS_FILE,
                []
            );

        const user =
            users.find(
                u => u.email === email
            );

        if (!user) {

            return res.status(401).json({
                success: false,
                message: "Incorrect email or password."
            });
        }

        const passwordHash =
            hashPassword(password);

        if (user.password !== passwordHash) {

            return res.status(401).json({
                success: false,
                message: "Incorrect email or password."
            });
        }

        const token =
            createToken();

        const sessions =
            readJSON(
                SESSIONS_FILE,
                {}
            );

        sessions[token] =
            user.id;

        writeJSON(
            SESSIONS_FILE,
            sessions
        );

        return res.json({

            success: true,

            message: "Login successful.",

            token,

            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }

        });

    } catch (error) {

        console.error("LOGIN ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Login failed."
        });
    }
});


// ============================================================
// LOGOUT
// ============================================================

app.post("/api/logout", (req, res) => {

    const token =
        getToken(req);

    if (token) {

        const sessions =
            readJSON(
                SESSIONS_FILE,
                {}
            );

        delete sessions[token];

        writeJSON(
            SESSIONS_FILE,
            sessions
        );
    }

    res.json({
        success: true,
        message: "Logged out."
    });
});


// ============================================================
// CURRENT USER
// ============================================================

app.get("/api/me", (req, res) => {

    const user =
        getCurrentUser(req);

    if (!user) {

        return res.status(401).json({
            success: false,
            message: "Not logged in."
        });
    }

    res.json({

        success: true,

        user: {
            id: user.id,
            name: user.name,
            email: user.email
        }

    });
});


// ============================================================
// SERPAPI IMAGE SEARCH
// ============================================================

async function searchSerpApi(query) {

    const apiKey =
        process.env.SERPAPI_KEY;

    if (!apiKey) {
        throw new Error(
            "SERPAPI_KEY is missing in .env"
        );
    }

    const url =
        "https://serpapi.com/search.json?" +
        new URLSearchParams({

            engine: "google_images",

            q: query,

            api_key: apiKey,

            safe: "active"

        }).toString();

    const response =
        await fetch(url);

    const data =
        await response.json();

    if (!response.ok) {

        console.error(
            "SERPAPI ERROR:",
            data
        );

        throw new Error(
            data?.error ||
            "SerpAPI image search failed."
        );
    }

    if (
        !data.images_results ||
        data.images_results.length === 0
    ) {

        throw new Error(
            "No matching images were found."
        );
    }

    return data.images_results;
}


// ============================================================
// DETECT REAL / EXISTING SUBJECT
// ============================================================

function shouldUseImageSearch(prompt) {

    const text =
        prompt
            .toLowerCase()
            .trim();

    const realPersonKeywords = [

        "prabhas",
        "prabhas actor",

        "virat kohli",
        "ms dhoni",
        "dhoni",

        "rohit sharma",

        "sachin tendulkar",

        "shah rukh khan",
        "shahrukh khan",

        "salman khan",

        "aamir khan",

        "amitabh bachchan",

        "alluarjun",
        "allu arjun",

        "ram charan",

        "jr ntr",

        "deepika padukone",

        "alia bhatt",

        "rashmika mandanna",

        "vijay deverakonda",

        "mahesh babu"

    ];

    const words =
        text.split(/\s+/);

    return realPersonKeywords.some(
        person => {

            if (text.includes(person)) {
                return true;
            }

            return person
                .split(/\s+/)
                .every(
                    word =>
                        words.includes(word)
                );
        }
    );
}


// ============================================================
// IMAGE SEARCH ROUTE
// ============================================================

app.post(
    "/api/search-image",
    requireAuth,
    async (req, res) => {

        try {

            const prompt =
                String(
                    req.body.prompt || ""
                ).trim();

            if (!prompt) {

                return res.status(400).json({
                    success: false,
                    message: "Search prompt is required."
                });
            }

            const results =
                await searchSerpApi(prompt);

            const images =
                results
                    .slice(0, 10)
                    .map(item => ({

                        title:
                            item.title ||
                            prompt,

                        image:
                            item.original ||
                            item.thumbnail,

                        source:
                            item.link ||
                            ""

                    }))
                    .filter(
                        item => item.image
                    );

            if (!images.length) {

                return res.status(404).json({
                    success: false,
                    message: "No usable image found."
                });
            }

            return res.json({

                success: true,

                type: "search",

                prompt,

                image: images[0].image,

                images

            });

        } catch (error) {

            console.error(
                "IMAGE SEARCH ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    error.message ||
                    "Image search failed."

            });
        }
    }
);


// ============================================================
// GENERATE / SEARCH IMAGE
// ============================================================

app.post(
    "/api/generate",
    requireAuth,
    async (req, res) => {

        try {

            const prompt =
                String(
                    req.body.prompt || ""
                ).trim();

            if (!prompt) {

                return res.status(400).json({
                    success: false,
                    message: "Prompt is required."
                });
            }


            // ------------------------------------------------
            // REAL PERSON / EXISTING SUBJECT
            // ------------------------------------------------

            if (
                shouldUseImageSearch(prompt)
            ) {

                console.log(
                    `Searching real image for: ${prompt}`
                );

                const results =
                    await searchSerpApi(
                        prompt
                    );

                const images =
                    results
                        .slice(0, 10)
                        .map(item => ({

                            title:
                                item.title ||
                                prompt,

                            image:
                                item.original ||
                                item.thumbnail,

                            source:
                                item.link ||
                                ""

                        }))
                        .filter(
                            item => item.image
                        );

                if (!images.length) {

                    throw new Error(
                        "No matching image found."
                    );
                }

                const selected =
                    images[0];


                saveHistory({

                    id:
                        crypto.randomUUID(),

                    userId:
                        req.user.id,

                    prompt,

                    type:
                        "image-search",

                    image:
                        selected.image,

                    source:
                        selected.source,

                    createdAt:
                        new Date().toISOString()

                });


                return res.json({

                    success: true,

                    type:
                        "image-search",

                    prompt,

                    image:
                        selected.image,

                    images

                });
            }


            // ------------------------------------------------
            // AI GENERATION
            // ------------------------------------------------

            console.log(
                `Generating AI image for: ${prompt}`
            );

            const image =
                await generateCloudflareImage(
                    prompt
                );


            saveHistory({

                id:
                    crypto.randomUUID(),

                userId:
                    req.user.id,

                prompt,

                type:
                    "ai-generated",

                image,

                createdAt:
                    new Date().toISOString()

            });


            return res.json({

                success: true,

                type:
                    "ai-generated",

                prompt,

                image

            });


        } catch (error) {

            console.error(
                "GENERATION ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    error.message ||
                    "Image generation failed."

            });
        }
    }
);


// ============================================================
// GENERATE-AI COMPATIBILITY ROUTE
// ============================================================

app.post(
    "/api/generate-ai",
    requireAuth,
    async (req, res) => {

        try {

            const prompt =
                String(
                    req.body.prompt || ""
                ).trim();

            if (!prompt) {

                return res.status(400).json({
                    success: false,
                    message: "Prompt is required."
                });
            }

            const image =
                await generateCloudflareImage(
                    prompt
                );

            saveHistory({

                id:
                    crypto.randomUUID(),

                userId:
                    req.user.id,

                prompt,

                type:
                    "ai-generated",

                image,

                createdAt:
                    new Date().toISOString()

            });

            res.json({

                success: true,

                type:
                    "ai-generated",

                prompt,

                image

            });

        } catch (error) {

            console.error(
                "AI GENERATION ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    error.message

            });
        }
    }
);


// ============================================================
// HISTORY
// ============================================================

function saveHistory(item) {

    const history =
        readJSON(
            HISTORY_FILE,
            []
        );

    history.unshift(item);

    writeJSON(
        HISTORY_FILE,
        history.slice(0, 100)
    );
}


app.get(
    "/api/history",
    requireAuth,
    (req, res) => {

        const history =
            readJSON(
                HISTORY_FILE,
                []
            );

        const userHistory =
            history.filter(
                item =>
                    item.userId ===
                    req.user.id
            );

        res.json({

            success: true,

            history:
                userHistory

        });
    }
);


// ============================================================
// DELETE HISTORY
// ============================================================

app.delete(
    "/api/history",
    requireAuth,
    (req, res) => {

        const history =
            readJSON(
                HISTORY_FILE,
                []
            );

        const remaining =
            history.filter(
                item =>
                    item.userId !==
                    req.user.id
            );

        writeJSON(
            HISTORY_FILE,
            remaining
        );

        res.json({

            success: true,

            message:
                "History deleted."

        });
    }
);


// ============================================================
// ROOT
// ============================================================

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );
});


// ============================================================
// API 404
// ============================================================

app.use("/api", (req, res) => {

    res.status(404).json({

        success: false,

        message:
            "API endpoint not found."

    });
});


// ============================================================
// GENERAL ERROR
// ============================================================

app.use(
    (err, req, res, next) => {

        console.error(err);

        res.status(500).json({

            success: false,

            message:
                "Server error."

        });
    }
);


// ============================================================
// START
// ============================================================

app.listen(
    PORT,
    () => {

        console.log("");
        console.log(
            "=========================================="
        );

        console.log(
            "          YANTRA-X SERVER"
        );

        console.log(
            "=========================================="
        );

        console.log(
            `Server running on port ${PORT}`
        );

        console.log(
            `Local: http://localhost:${PORT}`
        );

        console.log(
            ""
        );

        console.log(
            "POST /api/register"
        );

        console.log(
            "POST /api/login"
        );

        console.log(
            "POST /api/logout"
        );

        console.log(
            "GET  /api/me"
        );

        console.log(
            "GET  /api/history"
        );

        console.log(
            "DELETE /api/history"
        );

        console.log(
            "POST /api/generate"
        );

        console.log(
            "POST /api/generate-ai"
        );

        console.log(
            "POST /api/search-image"
        );

        console.log(
            "=========================================="
        );

    }
);