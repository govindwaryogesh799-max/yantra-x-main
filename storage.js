// ============================================================
// MEMBER 4 — DATABASE, HISTORY & TESTING
// ============================================================

const fs = require("fs");
const path = require("path");


// ============================================================
// DATA DIRECTORY
// ============================================================

const DATA_DIRECTORY =
    path.join(
        __dirname,
        "data"
    );


const USERS_FILE =
    path.join(
        DATA_DIRECTORY,
        "users.json"
    );


const HISTORY_FILE =
    path.join(
        DATA_DIRECTORY,
        "history.json"
    );


const SESSIONS_FILE =
    path.join(
        DATA_DIRECTORY,
        "sessions.json"
    );


// ============================================================
// CREATE DATA DIRECTORY
// ============================================================

function ensureDataDirectory() {

    if (
        !fs.existsSync(
            DATA_DIRECTORY
        )
    ) {

        fs.mkdirSync(
            DATA_DIRECTORY,
            {
                recursive: true
            }
        );
    }
}


// ============================================================
// CREATE FILE IF IT DOES NOT EXIST
// ============================================================

function ensureFile(filePath, defaultValue) {

    ensureDataDirectory();


    if (
        !fs.existsSync(filePath)
    ) {

        fs.writeFileSync(

            filePath,

            JSON.stringify(
                defaultValue,
                null,
                2
            )
        );
    }
}


// ============================================================
// READ JSON
// ============================================================

function readJSON(
    filePath,
    defaultValue
) {

    ensureFile(
        filePath,
        defaultValue
    );


    try {

        const data =
            fs.readFileSync(
                filePath,
                "utf8"
            );


        return JSON.parse(data);


    } catch (error) {

        console.error(
            `Could not read ${filePath}:`,
            error
        );


        return defaultValue;
    }
}


// ============================================================
// WRITE JSON
// ============================================================

function writeJSON(
    filePath,
    data
) {

    ensureDataDirectory();


    fs.writeFileSync(

        filePath,

        JSON.stringify(
            data,
            null,
            2
        )
    );
}


// ============================================================
// USERS
// ============================================================

function loadUsers() {

    return readJSON(
        USERS_FILE,
        []
    );
}


function saveUsers(users) {

    writeJSON(
        USERS_FILE,
        users
    );
}


// ============================================================
// SESSIONS
// ============================================================

function loadSessions() {

    return readJSON(
        SESSIONS_FILE,
        {}
    );
}


function saveSessions(sessions) {

    writeJSON(
        SESSIONS_FILE,
        sessions
    );
}


// ============================================================
// HISTORY
// ============================================================

function loadHistory() {

    return readJSON(
        HISTORY_FILE,
        []
    );
}


function saveHistory(history) {

    writeJSON(
        HISTORY_FILE,
        history
    );
}


// ============================================================
// ADD HISTORY
// ============================================================

function addHistory(item) {

    const history =
        loadHistory();


    history.unshift(item);


    saveHistory(history);
}


// ============================================================
// GET USER HISTORY
// ============================================================

function getUserHistory(userId) {

    const history =
        loadHistory();


    return history.filter(
        item =>
            item.userId === userId
    );
}


// ============================================================
// EXPORT
// ============================================================

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