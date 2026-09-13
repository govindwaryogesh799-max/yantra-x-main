"use strict";

/*
=========================================================
 YANTRA-X FRONTEND
 AI IMAGE GENERATOR
=========================================================

Features:
- Login / Signup
- Reference image upload
- Reference image resize
- Photorealistic image generation
- Same prompt can be generated repeatedly
- New random seed on EVERY generation
- Extra variation on repeated generations
- Robust image response handling
- Base64 image support
- Normal image URL support
- History
- Image modal
- Download
- Fast UI updates
=========================================================
*/


/* =====================================================
   GLOBAL
===================================================== */

const API = "";

let token =
    localStorage.getItem(
        "yantra_token"
    );

let referenceImage = null;

let isGenerating = false;

let generationNumber = 0;


/*
 * These are intentionally varied.
 *
 * They are added to the prompt so repeated identical
 * prompts can produce visually different compositions.
 */

const generationVariations = [
    "Use a fresh cinematic composition and a different camera angle.",
    "Use a different natural pose and photographic framing.",
    "Create a new perspective with different environmental details.",
    "Use a different camera distance and realistic depth of field.",
    "Create a fresh professional photography composition.",
    "Use different natural lighting and background arrangement.",
    "Use a new viewpoint with realistic photographic composition.",
    "Create a distinct cinematic scene with natural pose variation."
];


/* =====================================================
   HELPER
===================================================== */

function $(id) {
    return document.getElementById(id);
}


/* =====================================================
   PAGE SWITCHING
===================================================== */

function showPage(page) {

    const pages = [
        "loginPage",
        "signupPage",
        "generatorPage",
        "historyPage"
    ];

    pages.forEach(id => {

        const element =
            $(id);

        if (element) {

            element.classList.add(
                "hidden"
            );
        }
    });


    const target =
        $(page);

    if (target) {

        target.classList.remove(
            "hidden"
        );
    }
}


/* =====================================================
   MESSAGE
===================================================== */

function message(
    element,
    text,
    error = false
) {

    if (!element) {
        return;
    }

    element.textContent =
        text || "";

    element.className =
        error
            ? "message error"
            : "message success";
}


/* =====================================================
   API REQUEST
===================================================== */

async function api(
    url,
    options = {}
) {

    const headers = {
        ...(options.headers || {})
    };


    /*
     * Authentication
     */

    if (token) {

        headers.Authorization =
            `Bearer ${token}`;
    }


    /*
     * Automatically convert JavaScript objects
     * into JSON.
     */

    if (
        options.body &&
        typeof options.body === "object" &&
        !(options.body instanceof FormData) &&
        !(options.body instanceof Blob)
    ) {

        headers["Content-Type"] =
            "application/json";

        options.body =
            JSON.stringify(
                options.body
            );
    }


    const response =
        await fetch(
            API + url,
            {
                ...options,
                headers
            }
        );


    /*
     * Read response safely.
     */

    let data = null;

    const responseType =
        (
            response.headers.get(
                "content-type"
            ) || ""
        ).toLowerCase();


    if (
        responseType.includes(
            "application/json"
        )
    ) {

        try {

            data =
                await response.json();

        } catch {

            data = null;
        }

    } else {

        /*
         * Some servers may return raw image data.
         */

        try {

            const blob =
                await response.blob();

            if (
                blob.type &&
                blob.type.startsWith(
                    "image/"
                )
            ) {

                data = {
                    success: true,
                    imageBlob: blob
                };

            } else {

                const text =
                    await blob.text();

                try {

                    data =
                        JSON.parse(text);

                } catch {

                    data = {
                        success:
                            false,

                        message:
                            text ||
                            "Invalid server response."
                    };
                }
            }

        } catch {

            data = {
                success: false,
                message:
                    "Invalid server response."
            };
        }
    }


    /*
     * Session expired
     */

    if (
        response.status === 401
    ) {

        logout(false);

        throw new Error(
            "Your session has expired."
        );
    }


    /*
     * Error
     */

    if (
        !response.ok ||
        data?.success === false
    ) {

        throw new Error(
            data?.message ||
            `Request failed (${response.status}).`
        );
    }


    return data;
}


/* =====================================================
   LOGIN
===================================================== */

const loginForm =
    $("loginForm");

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const identifier =
                $("loginIdentifier")
                    ?.value
                    .trim();


            const password =
                $("loginPassword")
                    ?.value || "";


            const box =
                $("loginMessage");


            if (!identifier || !password) {

                message(
                    box,
                    "Please enter your email/username and password.",
                    true
                );

                return;
            }


            try {

                const data =
                    await api(
                        "/api/auth/login",
                        {
                            method: "POST",

                            body: {

                                email:
                                    identifier,

                                password
                            }
                        }
                    );


                token =
                    data.token;


                localStorage.setItem(
                    "yantra_token",
                    token
                );


                showApp();


            } catch (error) {

                message(
                    box,
                    error.message,
                    true
                );
            }
        }
    );
}


/* =====================================================
   SIGNUP
===================================================== */

const signupForm =
    $("signupForm");

if (signupForm) {

    signupForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const box =
                $("signupMessage");


            try {

                const data =
                    await api(
                        "/api/auth/signup",
                        {
                            method: "POST",

                            body: {

                                name:
                                    $("signupName")
                                        ?.value
                                        .trim(),

                                username:
                                    $("signupUsername")
                                        ?.value
                                        .trim(),

                                email:
                                    $("signupEmail")
                                        ?.value
                                        .trim(),

                                password:
                                    $("signupPassword")
                                        ?.value
                            }
                        }
                    );


                token =
                    data.token;


                localStorage.setItem(
                    "yantra_token",
                    token
                );


                showApp();


            } catch (error) {

                message(
                    box,
                    error.message,
                    true
                );
            }
        }
    );
}


/* =====================================================
   AUTH PAGE SWITCH
===================================================== */

const showSignup =
    $("showSignup");

if (showSignup) {

    showSignup.onclick =
        () => {

            showPage(
                "signupPage"
            );
        };
}


const showLogin =
    $("showLogin");

if (showLogin) {

    showLogin.onclick =
        () => {

            showPage(
                "loginPage"
            );
        };
}


/* =====================================================
   LOGOUT
===================================================== */

async function logout(
    callServer = true
) {

    try {

        if (
            callServer &&
            token
        ) {

            await fetch(
                "/api/auth/logout",
                {
                    method: "POST",

                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );
        }

    } catch {

        /*
         * Ignore logout network errors.
         */
    }


    token = null;


    localStorage.removeItem(
        "yantra_token"
    );


    showPage(
        "loginPage"
    );


    const navigation =
        $("navigation");

    if (navigation) {

        navigation.style.display =
            "none";
    }
}


const logoutButton =
    $("logoutButton");

if (logoutButton) {

    logoutButton.onclick =
        () => logout();
}


/* =====================================================
   SHOW APP
===================================================== */

function showApp() {

    const navigation =
        $("navigation");

    if (navigation) {

        navigation.style.display =
            "flex";
    }


    showPage(
        "generatorPage"
    );


    loadHistory();
}


/* =====================================================
   NAVIGATION
===================================================== */

document
    .querySelectorAll(
        "[data-page]"
    )
    .forEach(button => {

        button.onclick =
            () => {

                const page =
                    button.dataset.page;


                if (
                    page ===
                    "generator"
                ) {

                    showPage(
                        "generatorPage"
                    );
                }


                if (
                    page ===
                    "history"
                ) {

                    showPage(
                        "historyPage"
                    );

                    loadHistory();
                }
            };
    });


/* =====================================================
   REFERENCE IMAGE
===================================================== */

const referenceInput =
    $("referenceInput");


if (referenceInput) {

    referenceInput.addEventListener(
        "change",
        event => {

            const file =
                event.target
                    .files?.[0];


            if (!file) {
                return;
            }


            if (
                !file.type ||
                !file.type.startsWith(
                    "image/"
                )
            ) {

                alert(
                    "Please select an image file."
                );

                referenceInput.value =
                    "";

                return;
            }


            /*
             * Reasonable file size check.
             */

            if (
                file.size >
                15 * 1024 * 1024
            ) {

                alert(
                    "Please select an image smaller than 15 MB."
                );

                referenceInput.value =
                    "";

                return;
            }


            const reader =
                new FileReader();


            reader.onload =
                () => {

                    referenceImage =
                        reader.result;


                    const preview =
                        $("referencePreview");


                    if (preview) {

                        preview.src =
                            referenceImage;

                        preview.classList.remove(
                            "hidden"
                        );
                    }


                    const remove =
                        $("removeReference");


                    if (remove) {

                        remove.classList.remove(
                            "hidden"
                        );
                    }
                };


            reader.onerror =
                () => {

                    alert(
                        "Could not read the image."
                    );
                };


            reader.readAsDataURL(
                file
            );
        }
    );
}


/* =====================================================
   REMOVE REFERENCE
===================================================== */

const removeReference =
    $("removeReference");


if (removeReference) {

    removeReference.onclick =
        () => {

            referenceImage =
                null;


            if (referenceInput) {

                referenceInput.value =
                    "";
            }


            const preview =
                $("referencePreview");


            if (preview) {

                preview.src =
                    "";

                preview.classList.add(
                    "hidden"
                );
            }


            removeReference.classList.add(
                "hidden"
            );
        };
}


/* =====================================================
   RESIZE REFERENCE IMAGE
===================================================== */

async function resizeReference(
    dataUrl
) {

    return new Promise(
        (resolve, reject) => {

            const img =
                new Image();


            img.onload =
                () => {

                    /*
                     * Cloudflare reference images
                     * should be kept small.
                     */

                    const max =
                        512;


                    let width =
                        img.width;


                    let height =
                        img.height;


                    if (
                        width >
                        max ||
                        height >
                        max
                    ) {

                        const scale =
                            Math.min(
                                max / width,
                                max / height
                            );


                        width =
                            Math.max(
                                1,
                                Math.round(
                                    width *
                                    scale
                                )
                            );


                        height =
                            Math.max(
                                1,
                                Math.round(
                                    height *
                                    scale
                                )
                            );
                    }


                    const canvas =
                        document.createElement(
                            "canvas"
                        );


                    canvas.width =
                        width;


                    canvas.height =
                        height;


                    const ctx =
                        canvas.getContext(
                            "2d"
                        );


                    if (!ctx) {

                        reject(
                            new Error(
                                "Could not process reference image."
                            )
                        );

                        return;
                    }


                    ctx.drawImage(
                        img,
                        0,
                        0,
                        width,
                        height
                    );


                    resolve(
                        canvas.toDataURL(
                            "image/jpeg",
                            0.88
                        )
                    );
                };


            img.onerror =
                () => {

                    reject(
                        new Error(
                            "Could not process the reference image."
                        )
                    );
                };


            img.src =
                dataUrl;
        }
    );
}


/* =====================================================
   RANDOM SEED
===================================================== */

function createRandomSeed() {

    /*
     * crypto.randomUUID is available in modern browsers.
     *
     * We convert part of it into a numeric seed.
     */

    try {

        if (
            window.crypto &&
            typeof window.crypto.getRandomValues ===
                "function"
        ) {

            const array =
                new Uint32Array(
                    1
                );


            window.crypto.getRandomValues(
                array
            );


            return (
                array[0] %
                2147483647
            );
        }

    } catch {
        /* fallback below */
    }


    return Math.floor(
        Math.random() *
        2147483647
    );
}


/* =====================================================
   RANDOM VARIATION
===================================================== */

function getRandomVariation() {

    const index =
        Math.floor(
            Math.random() *
            generationVariations.length
        );


    return generationVariations[
        index
    ];
}


/* =====================================================
   GENERATE
===================================================== */

const generateButton =
    $("generateButton");


if (generateButton) {

    generateButton.onclick =
        async () => {

            /*
             * Prevent accidental double clicks.
             */

            if (isGenerating) {
                return;
            }


            const promptElement =
                $("prompt");


            const prompt =
                promptElement
                    ?.value
                    ?.trim() ||
                "";


            const box =
                $("generateMessage");


            if (!prompt) {

                message(
                    box,
                    "Please enter a prompt.",
                    true
                );

                promptElement?.focus();

                return;
            }


            if (!token) {

                showPage(
                    "loginPage"
                );

                return;
            }


            /*
             * Generation state
             */

            isGenerating =
                true;


            generationNumber++;


            generateButton.disabled =
                true;


            const generateText =
                $("generateText");


            const generateLoader =
                $("generateLoader");


            if (generateText) {

                generateText.classList.add(
                    "hidden"
                );
            }


            if (generateLoader) {

                generateLoader.classList.remove(
                    "hidden"
                );
            }


            if (box) {

                box.textContent =
                    "Creating a fresh image...";
            }


            /*
             * Show loading state in result.
             */

            showGeneratingState();


            try {

                /*
                 * Resize reference image if provided.
                 */

                let finalReference =
                    null;


                if (referenceImage) {

                    finalReference =
                        await resizeReference(
                            referenceImage
                        );
                }


                /*
                 * IMPORTANT:
                 *
                 * Every click gets a NEW seed.
                 *
                 * Therefore:
                 *
                 * Dhoni → seed A
                 * Dhoni → seed B
                 * Dhoni → seed C
                 *
                 * etc.
                 */

                const seed =
                    createRandomSeed();


                /*
                 * Add visual variation.
                 *
                 * This is NOT replacing the user's
                 * prompt. It simply gives the model
                 * a fresh composition instruction.
                 */

                const variation =
                    getRandomVariation();


                const finalPrompt =
                    `${prompt}. ${variation}`;


                console.log(
                    "[YANTRA-X] Generation:",
                    generationNumber
                );

                console.log(
                    "[YANTRA-X] Seed:",
                    seed
                );


                /*
                 * Size.
                 *
                 * Use the user's selected dimensions
                 * if available.
                 */

                const widthElement =
                    $("width");


                const heightElement =
                    $("height");


                const width =
                    Number(
                        widthElement?.value
                    ) ||
                    768;


                const height =
                    Number(
                        heightElement?.value
                    ) ||
                    768;


                /*
                 * Request generation.
                 */

                const data =
                    await api(
                        "/api/generate",
                        {
                            method: "POST",

                            body: {

                                /*
                                 * User's original prompt
                                 * is also sent separately.
                                 */

                                prompt,

                                /*
                                 * This is the prompt
                                 * actually used for visual
                                 * variation.
                                 */

                                generationPrompt:
                                    finalPrompt,

                                referenceImage:
                                    finalReference,

                                width,

                                height,

                                /*
                                 * NEW SEED EVERY TIME
                                 */

                                seed,

                                /*
                                 * Useful for backend logging.
                                 */

                                generationNumber
                            }
                        }
                    );


                console.log(
                    "[YANTRA-X] Server response:",
                    data
                );


                /*
                 * Display the returned image.
                 */

                await showGeneratedImage(
                    data,
                    prompt
                );


                message(
                    box,
                    "Image generated successfully."
                );


                /*
                 * Load history after the image
                 * is already displayed.
                 */

                loadHistory()
                    .catch(
                        error =>
                            console.warn(
                                "History refresh failed:",
                                error
                            )
                    );


            } catch (error) {

                console.error(
                    "[YANTRA-X] Generation error:",
                    error
                );


                showGenerationError(
                    error.message ||
                    "Image generation failed."
                );


                message(
                    box,
                    error.message ||
                    "Image generation failed.",
                    true
                );


            } finally {

                isGenerating =
                    false;


                generateButton.disabled =
                    false;


                if (generateText) {

                    generateText.classList.remove(
                        "hidden"
                    );
                }


                if (generateLoader) {

                    generateLoader.classList.add(
                        "hidden"
                    );
                }
            }
        };
}


/* =====================================================
   GENERATING STATE
===================================================== */

function showGeneratingState() {

    const result =
        $("result");


    if (!result) {
        return;
    }


    result.innerHTML = `

        <div class="empty-result">

            <div class="empty-icon">
                ✦
            </div>

            <h3>
                Generating your image...
            </h3>

            <p>
                Creating a fresh photorealistic variation.
            </p>

            <div
                style="
                    margin-top:16px;
                    opacity:.65;
                    font-size:12px;
                "
            >
                New composition and random seed
                are being used.
            </div>

        </div>

    `;
}


/* =====================================================
   GET IMAGE URL
===================================================== */

function getImageSource(
    data
) {

    if (!data) {
        return null;
    }


    /*
     * Most common server response.
     */

    const candidates = [

        data.imageUrl,

        data.image,

        data.url,

        data.output,

        data.result?.image,

        data.result?.imageUrl,

        data.data?.image,

        data.data?.imageUrl

    ];


    for (
        const candidate of candidates
    ) {

        if (
            typeof candidate ===
            "string" &&
            candidate.trim()
        ) {

            return candidate.trim();
        }
    }


    /*
     * Blob response.
     */

    if (
        data.imageBlob instanceof Blob
    ) {

        return URL.createObjectURL(
            data.imageBlob
        );
    }


    return null;
}


/* =====================================================
   NORMALIZE IMAGE SOURCE
===================================================== */

function normalizeImageSource(
    source
) {

    if (!source) {
        return null;
    }


    /*
     * Base64 data URL
     *
     * NEVER add ?v= to this.
     */

    if (
        source.startsWith(
            "data:image/"
        )
    ) {

        return source;
    }


    /*
     * Blob URL
     */

    if (
        source.startsWith(
            "blob:"
        )
    ) {

        return source;
    }


    /*
     * Absolute URL
     */

    if (
        source.startsWith(
            "http://"
        ) ||
        source.startsWith(
            "https://"
        )
    ) {

        return source;
    }


    /*
     * Relative URL
     */

    if (
        source.startsWith("/")
    ) {

        return (
            window.location.origin +
            source
        );
    }


    return source;
}


/* =====================================================
   SHOW GENERATED IMAGE
===================================================== */

async function showGeneratedImage(
    data,
    prompt = ""
) {

    const result =
        $("result");


    if (!result) {

        throw new Error(
            "Image result area was not found."
        );
    }


    let imageSource =
        getImageSource(
            data
        );


    if (!imageSource) {

        throw new Error(
            "The AI finished, but the server did not return an image."
        );
    }


    imageSource =
        normalizeImageSource(
            imageSource
        );


    /*
     * If it is already a data URL / blob URL,
     * it can be displayed directly.
     */

    let displaySource =
        imageSource;


    /*
     * For normal generated image URLs,
     * add cache busting.
     *
     * NEVER do this to data:image URLs.
     */

    if (
        imageSource &&
        !imageSource.startsWith(
            "data:"
        ) &&
        !imageSource.startsWith(
            "blob:"
        )
    ) {

        const separator =
            imageSource.includes("?")
                ? "&"
                : "?";


        displaySource =
            `${imageSource}${separator}v=${Date.now()}-${generationNumber}`;
    }


    /*
     * Clear loading state.
     */

    result.innerHTML = "";


    /*
     * Create image.
     */

    const image =
        document.createElement(
            "img"
        );


    image.className =
        "generated-image";


    image.alt =
        prompt ||
        data.prompt ||
        "Yantra-X generated image";


    image.loading =
        "eager";


    image.decoding =
        "async";


    image.src =
        displaySource;


    /*
     * Wait until browser confirms that
     * the image can actually be displayed.
     */

    await new Promise(
        (resolve, reject) => {

            let finished =
                false;


            const success =
                () => {

                    if (finished) {
                        return;
                    }

                    finished =
                        true;

                    resolve();
                };


            const failure =
                () => {

                    if (finished) {
                        return;
                    }

                    finished =
                        true;

                    reject(
                        new Error(
                            "The image was generated but the browser could not display it."
                        )
                    );
                };


            image.onload =
                success;


            image.onerror =
                failure;


            /*
             * Cached images may already be complete.
             */

            if (
                image.complete &&
                image.naturalWidth >
                    0
            ) {

                success();
            }
        }
    );


    /*
     * Add image to result.
     */

    result.appendChild(
        image
    );


    /*
     * Metadata.
     */

    const actions =
        document.createElement(
            "div"
        );


    actions.className =
        "image-actions";


    /*
     * Download button.
     */

    const download =
        document.createElement(
            "a"
        );


    download.href =
        displaySource;


    download.download =
        "yantra-x-image.png";


    download.textContent =
        "Download Image";


    download.className =
        "primary";


    actions.appendChild(
        download
    );


    /*
     * Open full-size image.
     */

    const viewButton =
        document.createElement(
            "button"
        );


    viewButton.type =
        "button";


    viewButton.textContent =
        "View Full Image";


    viewButton.className =
        "secondary";


    viewButton.onclick =
        () => {

            openModal(
                displaySource
            );
        };


    actions.appendChild(
        viewButton
    );


    result.appendChild(
        actions
    );


    /*
     * Generation information.
     */

    const meta =
        document.createElement(
            "div"
        );


    meta.style.cssText = `
        margin-top:10px;
        text-align:center;
        font-size:12px;
        opacity:.65;
    `;


    const usedReference =
        Boolean(
            data.usedReference
        );


    meta.textContent =
        `Seed: ${
            data.seed ??
            "random"
        } • ${
            usedReference
                ? "Reference image used"
                : "Fresh generation"
        }`;


    result.appendChild(
        meta
    );


    /*
     * Click generated image.
     */

    image.onclick =
        () => {

            openModal(
                displaySource
            );
        };


    console.log(
        "[YANTRA-X] IMAGE DISPLAYED"
    );


    return image;
}


/* =====================================================
   GENERATION ERROR
===================================================== */

function showGenerationError(
    text
) {

    const result =
        $("result");


    if (!result) {
        return;
    }


    result.innerHTML = `

        <div class="image-error">

            <h3>
                Generation failed
            </h3>

            <p>
                ${escapeHtml(
                    text ||
                    "Unable to generate the image."
                )}
            </p>

        </div>

    `;
}


/* =====================================================
   HISTORY
===================================================== */

async function loadHistory() {

    if (!token) {
        return;
    }


    const grid =
        $("historyGrid");


    if (!grid) {
        return;
    }


    try {

        const data =
            await api(
                "/api/history"
            );


        grid.innerHTML =
            "";


        const history =
            Array.isArray(
                data.history
            )
                ? data.history
                : [];


        if (!history.length) {

            grid.innerHTML =
                `
                <div class="empty-history">
                    No images generated yet.
                </div>
                `;

            return;
        }


        history.forEach(
            item => {

                const card =
                    document.createElement(
                        "div"
                    );


                card.className =
                    "history-card";


                /*
                 * Build image separately so
                 * URLs are not injected through
                 * innerHTML.
                 */

                const image =
                    document.createElement(
                        "img"
                    );


                image.alt =
                    "Generated image";


                const source =
                    normalizeImageSource(
                        item.imageUrl ||
                        item.image ||
                        item.url
                    );


                if (source) {

                    image.src =
                        source;
                }


                image.onclick =
                    () => {

                        if (source) {

                            openModal(
                                source
                            );
                        }
                    };


                card.appendChild(
                    image
                );


                const info =
                    document.createElement(
                        "div"
                    );


                info.className =
                    "history-info";


                const prompt =
                    document.createElement(
                        "p"
                    );


                prompt.textContent =
                    item.prompt ||
                    "Generated image";


                info.appendChild(
                    prompt
                );


                if (
                    item.createdAt
                ) {

                    const date =
                        document.createElement(
                            "small"
                        );


                    date.textContent =
                        new Date(
                            item.createdAt
                        ).toLocaleString();


                    info.appendChild(
                        date
                    );
                }


                if (
                    item.seed !==
                    undefined
                ) {

                    const seed =
                        document.createElement(
                            "small"
                        );


                    seed.style.display =
                        "block";


                    seed.style.opacity =
                        "0.6";


                    seed.textContent =
                        `Seed: ${item.seed}`;


                    info.appendChild(
                        seed
                    );
                }


                card.appendChild(
                    info
                );


                grid.appendChild(
                    card
                );
            }
        );


    } catch (error) {

        console.error(
            "[YANTRA-X] History error:",
            error
        );
    }
}


/* =====================================================
   CLEAR HISTORY
===================================================== */

const clearHistory =
    $("clearHistory");


if (clearHistory) {

    clearHistory.onclick =
        async () => {

            if (
                !confirm(
                    "Delete your complete history?"
                )
            ) {

                return;
            }


            try {

                await api(
                    "/api/history",
                    {
                        method: "DELETE"
                    }
                );


                loadHistory();


            } catch (error) {

                alert(
                    error.message
                );
            }
        };
}


/* =====================================================
   MODAL
===================================================== */

function openModal(
    src
) {

    const modal =
        $("imageModal");


    const modalImage =
        $("modalImage");


    if (
        !modal ||
        !modalImage ||
        !src
    ) {

        return;
    }


    modalImage.src =
        src;


    modal.classList.remove(
        "hidden"
    );
}


/* =====================================================
   CLOSE MODAL
===================================================== */

const closeModal =
    $("closeModal");


if (closeModal) {

    closeModal.onclick =
        () => {

            const modal =
                $("imageModal");


            if (modal) {

                modal.classList.add(
                    "hidden"
                );
            }
        };
}


/* =====================================================
   MODAL BACKGROUND CLICK
===================================================== */

const imageModal =
    $("imageModal");


if (imageModal) {

    imageModal.onclick =
        event => {

            if (
                event.target ===
                imageModal
            ) {

                imageModal.classList.add(
                    "hidden"
                );
            }
        };
}


/* =====================================================
   ESC KEY CLOSE MODAL
===================================================== */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
            "Escape"
        ) {

            const modal =
                $("imageModal");


            if (
                modal &&
                !modal.classList.contains(
                    "hidden"
                )
            ) {

                modal.classList.add(
                    "hidden"
                );
            }
        }
    }
);


/* =====================================================
   HTML ESCAPE
===================================================== */

function escapeHtml(
    text
) {

    return String(
        text ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


/* =====================================================
   INITIAL AUTH CHECK
===================================================== */

async function initialize() {

    const navigation =
        $("navigation");


    if (navigation) {

        navigation.style.display =
            "none";
    }


    if (!token) {

        showPage(
            "loginPage"
        );

        return;
    }


    try {

        await api(
            "/api/auth/me"
        );


        showApp();


    } catch {

        logout(false);
    }
}


/* =====================================================
   START
===================================================== */

initialize();