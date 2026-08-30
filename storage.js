const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");

const USERS_FILE = path.join(DATA_DIR, "users.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

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

function readJSON(file, fallback) {
    ensureData();

    try {
        return JSON.parse(
            fs.readFileSync(file, "utf8")
        );
    } catch {
        return fallback;
    }
}

function writeJSON(file, data) {
    ensureData();

    fs.writeFileSync(
        file,
        JSON.stringify(data, null, 2)
    );
}

function loadUsers() {
    return readJSON(USERS_FILE, []);
}

function saveUsers(users) {
    writeJSON(USERS_FILE, users);
}

function loadSessions() {
    return readJSON(SESSIONS_FILE, {});
}

function saveSessions(sessions) {
    writeJSON(SESSIONS_FILE, sessions);
}

function loadHistory() {
    return readJSON(HISTORY_FILE, []);
}

function saveHistory(history) {
    writeJSON(HISTORY_FILE, history);
}

function addHistory(item) {
    const history = loadHistory();

    history.unshift(item);

    saveHistory(
        history.slice(0, 100)
    );
}

function getUserHistory(userId) {
    return loadHistory().filter(
        item => item.userId === userId
    );
}

module.exports = {
    loadUsers,
    saveUsers,
    loadSessions,
    saveSessions,
    loadHistory,
    saveHistory,
    addHistory,
    getUserHistory
};