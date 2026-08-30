const API = "";

let authToken =
    localStorage.getItem("yantra_token");

let currentUser = null;


// ============================================================
// API HELPER
// ============================================================

async function apiRequest(
    endpoint,
    options = {}
) {

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (authToken) {

        headers.Authorization =
            `Bearer ${authToken}`;
    }

    const response =
        await fetch(
            API + endpoint,
            {
                ...options,
                headers
            }
        );

    let data;

    try {
        data =
            await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {

        throw new Error(
            data.message ||
            "Request failed."
        );
    }

    return data;
}


// ============================================================
// LOGIN
// ============================================================

async function login(
    email,
    password
) {

    const data =
        await apiRequest(
            "/api/login",
            {
                method: "POST",

                body: JSON.stringify({
                    email,
                    password
                })
            }
        );

    authToken =
        data.token;

    currentUser =
        data.user;

    localStorage.setItem(
        "yantra_token",
        authToken
    );

    localStorage.setItem(
        "yantra_user",
        JSON.stringify(currentUser)
    );

    return data;
}


// ============================================================
// REGISTER
// ============================================================

async function register(
    name,
    email,
    password
) {

    const data =
        await apiRequest(
            "/api/register",
            {
                method: "POST",

                body: JSON.stringify({
                    name,
                    email,
                    password
                })
            }
        );

    // IMPORTANT:
    // Server automatically logs
    // newly created account in.

    authToken =
        data.token;

    currentUser =
        data.user;

    localStorage.setItem(
        "yantra_token",
        authToken
    );

    localStorage.setItem(
        "yantra_user",
        JSON.stringify(currentUser)
    );

    return data;
}


// ============================================================
// LOGOUT
// ============================================================

async function logout() {

    try {

        await apiRequest(
            "/api/logout",
            {
                method: "POST"
            }
        );

    } catch {}

    authToken = null;
    currentUser = null;

    localStorage.removeItem(
        "yantra_token"
    );

    localStorage.removeItem(
        "yantra_user"
    );
}


// ============================================================
// CHECK LOGIN
// ============================================================

async function checkLogin() {

    if (!authToken) {
        return false;
    }

    try {

        const data =
            await apiRequest(
                "/api/me"
            );

        currentUser =
            data.user;

        localStorage.setItem(
            "yantra_user",
            JSON.stringify(
                currentUser
            )
        );

        return true;

    } catch {

        authToken = null;

        localStorage.removeItem(
            "yantra_token"
        );

        localStorage.removeItem(
            "yantra_user"
        );

        return false;
    }
}


// ============================================================
// GENERATE IMAGE
// ============================================================

async function generateImage(
    prompt
) {

    const data =
        await apiRequest(
            "/api/generate",
            {
                method: "POST",

                body: JSON.stringify({
                    prompt
                })
            }
        );

    return data;
}


// ============================================================
// LOAD HISTORY
// ============================================================

async function loadHistory() {

    const data =
        await apiRequest(
            "/api/history"
        );

    return data.history || [];
}


// ============================================================
// DOM
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        setupNavigation();

        setupLogin();

        setupSignup();

        setupPasswordToggles();

        setupGenerator();

        await checkLogin();

        updateAccountButton();

    }
);


// ============================================================
// NAVIGATION
// ============================================================

function setupNavigation() {

    document
        .querySelectorAll(
            "[data-view-link]"
        )
        .forEach(
            element => {

                element.addEventListener(
                    "click",
                    async event => {

                        event.preventDefault();

                        const view =
                            element.dataset.viewLink;

                        if (
                            view === "history"
                        ) {

                            if (!authToken) {

                                showView(
                                    "login"
                                );

                                return;
                            }

                            showView(
                                "history"
                            );

                            await renderHistory();

                            return;
                        }

                        if (
                            view === "generator"
                        ) {

                            showView(
                                "generator"
                            );

                            return;
                        }

                        if (
                            view === "login"
                        ) {

                            showView(
                                "login"
                            );
                        }
                    }
                );
            }
        );
}


function showView(
    viewName
) {

    document
        .querySelectorAll(
            ".view"
        )
        .forEach(
            view => {

                view.classList.remove(
                    "active"
                );
            }
        );

    const target =
        document.getElementById(
            `${viewName}-view`
        );

    if (target) {

        target.classList.add(
            "active"
        );
    }

    document
        .querySelectorAll(
            "[data-view-link]"
        )
        .forEach(
            link => {

                link.classList.toggle(
                    "active",
                    link.dataset.viewLink ===
                    viewName
                );
            }
        );
}


// ============================================================
// ACCOUNT BUTTON
// ============================================================

function updateAccountButton() {

    const button =
        document.getElementById(
            "accountButton"
        );

    if (!button) return;

    if (currentUser) {

        button.textContent =
            currentUser.name ||
            "Account";

        button.onclick =
            async () => {

                const shouldLogout =
                    confirm(
                        `Logged in as ${currentUser.email}\n\nLog out?`
                    );

                if (!shouldLogout) {
                    return;
                }

                await logout();

                updateAccountButton();

                showView(
                    "generator"
                );
            };

    } else {

        button.textContent =
            "Log in";

        button.onclick =
            () => {

                showView(
                    "login"
                );
            };
    }
}


// ============================================================
// LOGIN FORM
// ============================================================

function setupLogin() {

    const form =
        document.getElementById(
            "loginForm"
        );

    if (!form) return;

    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const email =
                document
                    .getElementById(
                        "email"
                    )
                    .value
                    .trim();

            const password =
                document
                    .getElementById(
                        "password"
                    )
                    .value;

            const message =
                document.getElementById(
                    "loginMessage"
                );

            try {

                message.textContent =
                    "Logging in...";

                const data =
                    await login(
                        email,
                        password
                    );

                message.textContent =
                    data.message;

                updateAccountButton();

                showView(
                    "generator"
                );

            } catch (error) {

                message.textContent =
                    error.message;

            }
        }
    );
}


// ============================================================
// SIGNUP FORM
// ============================================================

function setupSignup() {

    const form =
        document.getElementById(
            "signupForm"
        );

    if (!form) return;

    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const name =
                document
                    .getElementById(
                        "signupName"
                    )
                    .value
                    .trim();

            const email =
                document
                    .getElementById(
                        "signupEmail"
                    )
                    .value
                    .trim();

            const password =
                document
                    .getElementById(
                        "signupPassword"
                    )
                    .value;

            const confirmPassword =
                document
                    .getElementById(
                        "confirmPassword"
                    )
                    .value;

            const message =
                document.getElementById(
                    "signupMessage"
                );


            if (
                password !==
                confirmPassword
            ) {

                message.textContent =
                    "Passwords do not match.";

                return;
            }


            try {

                message.textContent =
                    "Creating account...";


                const data =
                    await register(
                        name,
                        email,
                        password
                    );


                message.textContent =
                    data.message;


                updateAccountButton();


                // Go directly to generator
                showView(
                    "generator"
                );


            } catch (error) {

                message.textContent =
                    error.message;

            }
        }
    );


    const signupButton =
        document.getElementById(
            "signupButton"
        );

    if (signupButton) {

        signupButton.onclick =
            () => {

                showView(
                    "signup"
                );
            };
    }


    const backToLogin =
        document.getElementById(
            "backToLogin"
        );

    if (backToLogin) {

        backToLogin.onclick =
            () => {

                showView(
                    "login"
                );
            };
    }
}


// ============================================================
// PASSWORD TOGGLES
// ============================================================

function setupPasswordToggles() {

    const pairs = [

        [
            "passwordToggle",
            "password"
        ],

        [
            "signupPasswordToggle",
            "signupPassword"
        ],

        [
            "confirmPasswordToggle",
            "confirmPassword"
        ]

    ];


    pairs.forEach(
        ([buttonId, inputId]) => {

            const button =
                document.getElementById(
                    buttonId
                );

            const input =
                document.getElementById(
                    inputId
                );

            if (
                !button ||
                !input
            ) {
                return;
            }


            button.onclick =
                () => {

                    if (
                        input.type ===
                        "password"
                    ) {

                        input.type =
                            "text";

                        button.textContent =
                            "Hide";

                    } else {

                        input.type =
                            "password";

                        button.textContent =
                            "Show";
                    }
                };
        }
    );
}


// ============================================================
// GENERATOR
// ============================================================

function setupGenerator() {

    const button =
        document.getElementById(
            "generateBtn"
        );

    const promptInput =
        document.getElementById(
            "prompt"
        );

    const container =
        document.getElementById(
            "imageContainer"
        );

    if (
        !button ||
        !promptInput ||
        !container
    ) {
        return;
    }


    button.addEventListener(
        "click",
        async () => {

            if (!authToken) {

                showView(
                    "login"
                );

                return;
            }


            const prompt =
                promptInput.value.trim();


            if (!prompt) {

                container.innerHTML =
                    "<p>Please describe the image you want.</p>";

                return;
            }


            button.disabled =
                true;

            button.textContent =
                "Creating...";


            container.innerHTML = `

                <div class="generation-loading">

                    <div class="loader"></div>

                    <p>
                        Creating your image...
                    </p>

                </div>

            `;


            try {

                const data =
                    await generateImage(
                        prompt
                    );


                displayGeneratedImage(
                    data
                );


            } catch (error) {

                container.innerHTML = `

                    <div class="generation-error">

                        <strong>
                            Generation failed
                        </strong>

                        <p>
                            ${escapeHTML(
                                error.message
                            )}
                        </p>

                    </div>

                `;

            } finally {

                button.disabled =
                    false;

                button.textContent =
                    "Generate image";
            }
        }
    );
}


// ============================================================
// DISPLAY IMAGE
// ============================================================

function displayGeneratedImage(
    data
) {

    const container =
        document.getElementById(
            "imageContainer"
        );

    if (!container) return;


    const type =
        data.type ===
        "image-search"
            ? "Real image search"
            : "AI generated";


    container.innerHTML = `

        <div class="generated-result">

            <div class="result-badge">
                ${type}
            </div>

            <img
                src="${data.image}"
                alt="${escapeHTML(data.prompt)}"
                class="generated-image"
            >

            <div class="result-info">

                <p>
                    <strong>Prompt:</strong>
                    ${escapeHTML(data.prompt)}
                </p>

                ${
                    data.source
                        ? `
                        <a
                            href="${data.source}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            View source
                        </a>
                        `
                        : ""
                }

            </div>

        </div>

    `;
}


// ============================================================
// HISTORY
// ============================================================

async function renderHistory() {

    const list =
        document.getElementById(
            "historyList"
        );

    if (!list) return;


    list.innerHTML = `
        <div class="generation-loading">
            <div class="loader"></div>
            <p>Loading history...</p>
        </div>
    `;


    try {

        const history =
            await loadHistory();


        if (!history.length) {

            list.innerHTML = `
                <div class="empty-history">
                    <h3>No creations yet</h3>
                    <p>
                        Generate your first image
                        to see it here.
                    </p>
                </div>
            `;

            return;
        }


        list.innerHTML =
            history.map(
                item => `

                <article
                    class="history-card"
                >

                    <img
                        src="${item.image}"
                        alt="${escapeHTML(item.prompt)}"
                    >

                    <div>

                        <span>
                            ${
                                item.type ===
                                "image-search"
                                    ? "Image Search"
                                    : "AI Generated"
                            }
                        </span>

                        <h3>
                            ${escapeHTML(
                                item.prompt
                            )}
                        </h3>

                        <small>
                            ${new Date(
                                item.createdAt
                            ).toLocaleString()}
                        </small>

                    </div>

                </article>

            `
            )
            .join("");


    } catch (error) {

        list.innerHTML = `
            <p>
                ${escapeHTML(
                    error.message
                )}
            </p>
        `;
    }
}


// ============================================================
// HTML ESCAPE
// ============================================================

function escapeHTML(
    value
) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}