/* =========================================================
   YANTRA-X
   Complete Frontend Script

   Features:
   ✓ Create page
   ✓ Login page
   ✓ Logout
   ✓ History page
   ✓ Per-user history
   ✓ No localStorage quota error
   ✓ Cloudflare image generation through /api/generate
   ✓ Download image
   ✓ Regenerate image
   ✓ Password show/hide
   ✓ Enter key generation
========================================================= */


/* =========================================================
   1. GET HTML ELEMENTS
========================================================= */

const promptInput = document.getElementById("prompt");
const generateBtn = document.getElementById("generateBtn");
const imageContainer = document.querySelector(".image-container");

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginMessage = document.getElementById("loginMessage");

const passwordToggle =
    document.getElementById("passwordToggle");

const forgotPassword =
    document.getElementById("forgotPassword");

const signupButton =
    document.getElementById("signupButton");

const rememberLogin =
    document.getElementById("rememberLogin");

const historyList =
    document.getElementById("historyList");


/* =========================================================
   2. PAGE VIEWS
========================================================= */

const generatorView =
    document.getElementById("generator-view");

const historyView =
    document.getElementById("history-view");

const loginView =
    document.getElementById("login-view");


/* =========================================================
   3. VARIABLES
========================================================= */

let lastPrompt = "";
let lastImageData = "";


/* =========================================================
   4. USER LOGIN STORAGE
========================================================= */

function getCurrentUser() {

    return localStorage.getItem("yantraXUser");

}


/* =========================================================
   5. SET USER
========================================================= */

function setCurrentUser(email) {

    localStorage.setItem(
        "yantraXUser",
        email.toLowerCase()
    );

}


/* =========================================================
   6. LOGOUT
========================================================= */

function logoutUser() {

    localStorage.removeItem("yantraXUser");

    updateAccountButton();

    showView("login");

    if (loginMessage) {

        loginMessage.textContent =
            "You have been logged out.";

    }

}


/* =========================================================
   7. UPDATE ACCOUNT BUTTON
========================================================= */

function updateAccountButton() {

    const accountButton =
        document.querySelector(".account-button");

    if (!accountButton) {
        return;
    }

    const user =
        getCurrentUser();

    if (user) {

        accountButton.textContent =
            "Log out";

        accountButton.dataset.viewLink =
            "logout";

    } else {

        accountButton.textContent =
            "Log in";

        accountButton.dataset.viewLink =
            "login";

    }

}


/* =========================================================
   8. SHOW PAGE
========================================================= */

function showView(viewName) {

    /*
       Hide all normal views
    */

    document
        .querySelectorAll(".view")
        .forEach(view => {

            view.classList.remove("active");

        });


    /*
       Remove active navigation
    */

    document
        .querySelectorAll(".nav-link")
        .forEach(link => {

            link.classList.remove("active");

        });


    /* -----------------------------------------------------
       CREATE
    ----------------------------------------------------- */

    if (viewName === "generator") {

        if (generatorView) {

            generatorView.classList.add("active");

        }

        const createButton =
            document.querySelector(
                '.nav-link[data-view-link="generator"]'
            );

        if (createButton) {

            createButton.classList.add("active");

        }

        return;
    }


    /* -----------------------------------------------------
       HISTORY
    ----------------------------------------------------- */

    if (viewName === "history") {

        if (!getCurrentUser()) {

            showView("login");

            if (loginMessage) {

                loginMessage.textContent =
                    "Please log in to view your history.";

            }

            return;

        }


        if (historyView) {

            historyView.classList.add("active");

        }


        const historyButton =
            document.querySelector(
                '.nav-link[data-view-link="history"]'
            );

        if (historyButton) {

            historyButton.classList.add("active");

        }


        loadHistory();

        return;
    }


    /* -----------------------------------------------------
       LOGIN
    ----------------------------------------------------- */

    if (viewName === "login") {

        if (loginView) {

            loginView.classList.add("active");

        }

        return;

    }

}


/* =========================================================
   9. NAVIGATION
========================================================= */

document
    .querySelectorAll("[data-view-link]")
    .forEach(link => {

        link.addEventListener(
            "click",
            function(event) {

                event.preventDefault();

                const destination =
                    this.dataset.viewLink;


                /* Logout */

                if (destination === "logout") {

                    logoutUser();

                    return;

                }


                /* Login */

                if (destination === "login") {

                    if (getCurrentUser()) {

                        logoutUser();

                    } else {

                        showView("login");

                    }

                    return;

                }


                /* Create / History */

                showView(destination);

            }
        );

    });


/* =========================================================
   10. LOGIN
========================================================= */

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        function(event) {

            event.preventDefault();


            const email =
                emailInput.value.trim();

            const password =
                passwordInput.value;


            if (!email) {

                loginMessage.textContent =
                    "Please enter your email.";

                return;

            }


            if (!password) {

                loginMessage.textContent =
                    "Please enter your password.";

                return;

            }


            if (password.length < 6) {

                loginMessage.textContent =
                    "Password must contain at least 6 characters.";

                return;

            }


            /*
               Save user
            */

            setCurrentUser(email);


            /*
               Remember login
            */

            if (
                rememberLogin &&
                rememberLogin.checked
            ) {

                localStorage.setItem(
                    "yantraXRemember",
                    "true"
                );

            }


            loginMessage.textContent =
                "Login successful!";


            updateAccountButton();


            /*
               Open Create page
            */

            setTimeout(
                function() {

                    showView("generator");

                },
                500
            );

        }
    );

}


/* =========================================================
   11. SHOW / HIDE PASSWORD
========================================================= */

if (
    passwordToggle &&
    passwordInput
) {

    passwordToggle.addEventListener(
        "click",
        function() {

            if (
                passwordInput.type ===
                "password"
            ) {

                passwordInput.type =
                    "text";

                passwordToggle.textContent =
                    "Hide";

                passwordToggle.setAttribute(
                    "aria-label",
                    "Hide password"
                );

            } else {

                passwordInput.type =
                    "password";

                passwordToggle.textContent =
                    "Show";

                passwordToggle.setAttribute(
                    "aria-label",
                    "Show password"
                );

            }

        }
    );

}


/* =========================================================
   12. FORGOT PASSWORD
========================================================= */

if (forgotPassword) {

    forgotPassword.addEventListener(
        "click",
        function(event) {

            event.preventDefault();

            alert(
                "Password reset can be connected to your backend later."
            );

        }
    );

}


/* =========================================================
   13. SIGN UP
========================================================= */

if (signupButton) {

    signupButton.addEventListener(
        "click",
        function() {

            alert(
                "Account creation can be connected to your backend later."
            );

        }
    );

}


/* =========================================================
   14. GENERATE IMAGE
========================================================= */

async function generateImage() {

    const prompt =
        promptInput.value.trim();


    /*
       Empty prompt
    */

    if (!prompt) {

        alert(
            "Please enter a prompt."
        );

        return;

    }


    /*
       Require login
    */

    if (!getCurrentUser()) {

        showView("login");

        if (loginMessage) {

            loginMessage.textContent =
                "Please log in before generating an image.";

        }

        return;

    }


    lastPrompt =
        prompt;


    /*
       Loading screen
    */

    imageContainer.innerHTML = `

        <div class="loading">

            <div class="spinner"></div>

            <div>
                Generating your image...
            </div>

        </div>

    `;


    generateBtn.disabled =
        true;

    generateBtn.textContent =
        "Generating...";


    try {

        /*
           Call your Node.js / Cloudflare backend
        */

        const response =
            await fetch(
                "/api/generate",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        prompt: prompt
                    })
                }
            );


        const data =
            await response.json();


        /*
           Backend error
        */

        if (!response.ok) {

            throw new Error(
                data.error ||
                "Image generation failed."
            );

        }


        /*
           No image
        */

        if (!data.image) {

            throw new Error(
                "No image was returned by the server."
            );

        }


        /*
           Save image temporarily
           ONLY in memory.

           We do NOT save this in
           localStorage.
        */

        lastImageData =
            data.image;


        /*
           DISPLAY IMAGE
        */

        displayGeneratedImage(
            prompt,
            data.image
        );


        /*
           Save ONLY prompt/date
           to history.
        */

        saveHistory(
            prompt
        );


    } catch (error) {

        console.error(
            "Generation error:",
            error
        );


        imageContainer.innerHTML = `

            <div class="empty-state">

                ❌
                ${escapeHtml(
                    error.message
                )}

            </div>

        `;

    } finally {

        generateBtn.disabled =
            false;

        generateBtn.textContent =
            "Generate image";

    }

}


/* =========================================================
   15. DISPLAY GENERATED IMAGE
========================================================= */

function displayGeneratedImage(
    prompt,
    image
) {

    imageContainer.innerHTML = `

        <div class="generated-result">

            <div class="generated-image-wrapper">

                <img
                    src="${image}"
                    alt="${escapeHtml(prompt)}"
                    class="generated-image"
                >

            </div>


            <div class="image-info">

                <div class="image-prompt">

                    ${escapeHtml(prompt)}

                </div>


                <div class="image-actions">

                    <button
                        type="button"
                        class="download-button"
                        id="downloadImageBtn"
                    >
                        Download image
                    </button>


                    <button
                        type="button"
                        class="regenerate-button"
                        id="regenerateImageBtn"
                    >
                        Regenerate
                    </button>

                </div>

            </div>

        </div>

    `;


    /*
       Download
    */

    const downloadButton =
        document.getElementById(
            "downloadImageBtn"
        );

    if (downloadButton) {

        downloadButton.addEventListener(
            "click",
            downloadImage
        );

    }


    /*
       Regenerate
    */

    const regenerateButton =
        document.getElementById(
            "regenerateImageBtn"
        );

    if (regenerateButton) {

        regenerateButton.addEventListener(
            "click",
            generateImage
        );

    }

}


/* =========================================================
   16. GENERATE BUTTON
========================================================= */

if (generateBtn) {

    generateBtn.addEventListener(
        "click",
        generateImage
    );

}


/* =========================================================
   17. ENTER KEY
========================================================= */

if (promptInput) {

    promptInput.addEventListener(
        "keydown",
        function(event) {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                generateImage();

            }

        }
    );

}


/* =========================================================
   18. DOWNLOAD IMAGE
========================================================= */

async function downloadImage() {

    if (!lastImageData) {

        alert(
            "No generated image available."
        );

        return;

    }


    try {

        /*
           DATA URL
        */

        if (
            lastImageData.startsWith(
                "data:"
            )
        ) {

            const response =
                await fetch(
                    lastImageData
                );


            const blob =
                await response.blob();


            const url =
                URL.createObjectURL(
                    blob
                );


            const link =
                document.createElement(
                    "a"
                );


            link.href =
                url;


            link.download =
                "yantra-x-generated-image.png";


            document.body.appendChild(
                link
            );


            link.click();


            link.remove();


            setTimeout(
                function() {

                    URL.revokeObjectURL(
                        url
                    );

                },
                1000
            );


            return;

        }


        /*
           NORMAL IMAGE URL
        */

        const response =
            await fetch(
                lastImageData
            );


        if (!response.ok) {

            throw new Error(
                "Could not download image."
            );

        }


        const blob =
            await response.blob();


        const url =
            URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                "a"
            );


        link.href =
            url;


        link.download =
            "yantra-x-generated-image.png";


        document.body.appendChild(
            link
        );


        link.click();


        link.remove();


        setTimeout(
            function() {

                URL.revokeObjectURL(
                    url
                );

            },
            1000
        );


    } catch (error) {

        console.error(
            "Download error:",
            error
        );


        /*
           Fallback:
           open the image in a new tab
        */

        try {

            const link =
                document.createElement(
                    "a"
                );

            link.href =
                lastImageData;

            link.target =
                "_blank";

            link.download =
                "yantra-x-generated-image.png";

            document.body.appendChild(
                link
            );

            link.click();

            link.remove();

        } catch {

            alert(
                "Unable to download the image."
            );

        }

    }

}


/* =========================================================
   19. HISTORY KEY
========================================================= */

function getHistoryKey() {

    const user =
        getCurrentUser();


    if (!user) {

        return null;

    }


    return (
        "yantraXHistory_" +
        user.toLowerCase()
    );

}


/* =========================================================
   20. SAVE HISTORY
=========================================================

   IMPORTANT:

   We save ONLY:

       prompt
       date

   We DO NOT save the base64 image.

   This completely prevents:

       "exceeded the quota"

   ========================================================= */

function saveHistory(prompt) {

    const key =
        getHistoryKey();


    if (!key) {

        return;

    }


    let history = [];


    try {

        history =
            JSON.parse(
                localStorage.getItem(
                    key
                )
            ) || [];

    } catch {

        history = [];

    }


    /*
       Add newest item first
    */

    history.unshift({

        prompt:
            prompt,

        date:
            new Date().toLocaleString()

    });


    /*
       Keep maximum 20 prompts
    */

    history =
        history.slice(
            0,
            20
        );


    try {

        localStorage.setItem(
            key,
            JSON.stringify(history)
        );

    } catch (error) {

        console.error(
            "History storage error:",
            error
        );

    }

}


/* =========================================================
   21. LOAD HISTORY
========================================================= */

function loadHistory() {

    if (!historyList) {

        return;

    }


    const key =
        getHistoryKey();


    if (!key) {

        historyList.innerHTML = `

            <div class="empty-state">

                Please log in to view your history.

            </div>

        `;

        return;

    }


    let history = [];


    try {

        history =
            JSON.parse(
                localStorage.getItem(
                    key
                )
            ) || [];

    } catch {

        history = [];

    }


    /*
       No history
    */

    if (history.length === 0) {

        historyList.innerHTML = `

            <div class="empty-state">

                No images generated yet.

            </div>

        `;

        return;

    }


    /*
       History list
    */

    historyList.innerHTML =
        history
            .map(
                function(item, index) {

                    return `

                        <div
                            class="history-item"
                        >

                            <div>

                                <strong>
                                    ${escapeHtml(
                                        item.prompt
                                    )}
                                </strong>

                                <span>
                                    ${escapeHtml(
                                        item.date
                                    )}
                                </span>

                            </div>


                            <button
                                type="button"
                                class="small-button"
                                data-history-index="${index}"
                            >
                                Use prompt
                            </button>

                        </div>

                    `;

                }
            )
            .join("");


    /*
       Use prompt buttons
    */

    document
        .querySelectorAll(
            "[data-history-index]"
        )
        .forEach(
            function(button) {

                button.addEventListener(
                    "click",
                    function() {

                        const index =
                            Number(
                                this.dataset
                                    .historyIndex
                            );


                        useHistoryPrompt(
                            index
                        );

                    }
                );

            }
        );

}


/* =========================================================
   22. USE HISTORY PROMPT
========================================================= */

function useHistoryPrompt(index) {

    const key =
        getHistoryKey();


    if (!key) {

        return;

    }


    let history = [];


    try {

        history =
            JSON.parse(
                localStorage.getItem(
                    key
                )
            ) || [];

    } catch {

        history = [];

    }


    const item =
        history[index];


    if (!item) {

        return;

    }


    /*
       Put prompt into generator
    */

    promptInput.value =
        item.prompt;


    /*
       Open Create
    */

    showView(
        "generator"
    );


    /*
       Tell user to generate
    */

    imageContainer.innerHTML = `

        <div class="empty-state">

            Prompt loaded.
            Click <strong>Generate image</strong>
            to create it again.

        </div>

    `;

}


/* =========================================================
   23. ESCAPE HTML
========================================================= */

function escapeHtml(text) {

    if (
        text === null ||
        text === undefined
    ) {

        return "";

    }


    return String(text)

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


/* =========================================================
   24. INITIALIZE
========================================================= */

function initializeApp() {

    /*
       Update Login / Logout
    */

    updateAccountButton();


    /*
       Always start on Create page
    */

    showView(
        "generator"
    );

}


/* =========================================================
   25. START
========================================================= */

initializeApp();