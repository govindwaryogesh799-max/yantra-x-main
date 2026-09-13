"use strict";

const { Pool } = require("pg");
const fs = require("fs");

let pool = null;

/*
===========================================================
POSTGRESQL DATABASE
===========================================================
*/

function databaseConfigured() {
    return Boolean(process.env.DATABASE_URL);
}


/*
===========================================================
CREATE DATABASE CONNECTION
===========================================================
*/

if (databaseConfigured()) {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,

        // Render PostgreSQL uses TLS.
        ssl: {
            rejectUnauthorized: false
        },

        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
    });

    pool.on("error", (error) => {
        console.error(
            "[YANTRA-X] PostgreSQL pool error:",
            error.message
        );
    });
}


/*
===========================================================
INITIALIZE TABLES
===========================================================
*/

async function initDatabase() {

    if (!pool) {
        console.log(
            "[YANTRA-X] DATABASE_URL not configured. Using local JSON database."
        );

        return;
    }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            username TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx
        ON users (LOWER(username))
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS sessions_user_id_idx
        ON sessions(user_id)
    `);

    console.log(
        "[YANTRA-X] PostgreSQL tables are ready."
    );
}


/*
===========================================================
MIGRATE EXISTING JSON USERS
===========================================================
*/

async function migrateUsersFromJson(usersFile) {

    if (!pool) {
        return;
    }

    try {

        if (!fs.existsSync(usersFile)) {
            return;
        }

        const raw =
            fs.readFileSync(
                usersFile,
                "utf8"
            );

        if (!raw.trim()) {
            return;
        }

        const users =
            JSON.parse(raw);

        if (!Array.isArray(users)) {
            return;
        }

        let migrated = 0;

        for (const user of users) {

            if (
                !user ||
                !user.id ||
                !user.email ||
                !user.password
            ) {
                continue;
            }

            const name =
                String(
                    user.name || ""
                ).trim();

            const username =
                String(
                    user.username || user.email
                ).trim();

            const email =
                String(
                    user.email
                )
                .trim()
                .toLowerCase();

            try {

                const result =
                    await pool.query(
                        `
                        INSERT INTO users
                        (
                            id,
                            name,
                            username,
                            email,
                            password,
                            created_at
                        )
                        VALUES
                        ($1, $2, $3, $4, $5, $6)
                        ON CONFLICT (id)
                        DO NOTHING
                        `,
                        [
                            String(user.id),
                            name || username,
                            username,
                            email,
                            String(user.password),
                            user.createdAt
                                ? new Date(user.createdAt)
                                : new Date()
                        ]
                    );

                if (result.rowCount > 0) {
                    migrated++;
                }

            } catch (error) {

                // If email or username already exists,
                // don't stop the entire migration.
                console.log(
                    "[YANTRA-X] User migration skipped:",
                    email,
                    error.message
                );
            }
        }

        if (migrated > 0) {
            console.log(
                `[YANTRA-X] Migrated ${migrated} user(s) from JSON to PostgreSQL.`
            );
        }

    } catch (error) {

        console.error(
            "[YANTRA-X] User migration error:",
            error.message
        );
    }
}


/*
===========================================================
FIND USER
===========================================================
*/

async function findUser(identifier) {

    if (!pool) {
        return null;
    }

    const value =
        String(
            identifier || ""
        )
        .trim()
        .toLowerCase();

    const result =
        await pool.query(
            `
            SELECT
                id,
                name,
                username,
                email,
                password,
                created_at
            FROM users
            WHERE
                LOWER(email) = $1
                OR LOWER(username) = $1
            LIMIT 1
            `,
            [value]
        );

    if (!result.rows.length) {
        return null;
    }

    const row =
        result.rows[0];

    return {
        id: row.id,
        name: row.name,
        username: row.username,
        email: row.email,
        password: row.password,
        createdAt: row.created_at
    };
}


/*
===========================================================
CREATE USER
===========================================================
*/

async function createUser(user) {

    if (!pool) {
        return null;
    }

    const result =
        await pool.query(
            `
            INSERT INTO users
            (
                id,
                name,
                username,
                email,
                password,
                created_at
            )
            VALUES
            ($1, $2, $3, $4, $5, $6)
            RETURNING
                id,
                name,
                username,
                email,
                password,
                created_at
            `,
            [
                user.id,
                user.name,
                user.username,
                user.email,
                user.password,
                user.createdAt
                    ? new Date(user.createdAt)
                    : new Date()
            ]
        );

    const row =
        result.rows[0];

    return {
        id: row.id,
        name: row.name,
        username: row.username,
        email: row.email,
        password: row.password,
        createdAt: row.created_at
    };
}


/*
===========================================================
CHECK USER EXISTS
===========================================================
*/

async function userExists(
    email,
    username
) {

    if (!pool) {
        return false;
    }

    const result =
        await pool.query(
            `
            SELECT id
            FROM users
            WHERE
                LOWER(email) = $1
                OR LOWER(username) = $2
            LIMIT 1
            `,
            [
                String(email || "")
                    .trim()
                    .toLowerCase(),

                String(username || "")
                    .trim()
                    .toLowerCase()
            ]
        );

    return result.rows.length > 0;
}


/*
===========================================================
CREATE SESSION
===========================================================
*/

async function createSession(
    token,
    userId
) {

    if (!pool) {
        return;
    }

    await pool.query(
        `
        INSERT INTO sessions
        (
            token,
            user_id
        )
        VALUES
        ($1, $2)
        `,
        [
            token,
            userId
        ]
    );
}


/*
===========================================================
GET USER FROM SESSION
===========================================================
*/

async function getUserFromSession(
    token
) {

    if (!pool) {
        return null;
    }

    const result =
        await pool.query(
            `
            SELECT
                u.id,
                u.name,
                u.username,
                u.email,
                u.password,
                u.created_at
            FROM sessions s
            INNER JOIN users u
                ON u.id = s.user_id
            WHERE s.token = $1
            LIMIT 1
            `,
            [token]
        );

    if (!result.rows.length) {
        return null;
    }

    const row =
        result.rows[0];

    return {
        id: row.id,
        name: row.name,
        username: row.username,
        email: row.email,
        password: row.password,
        createdAt: row.created_at
    };
}


/*
===========================================================
DELETE SESSION
===========================================================
*/

async function deleteSession(
    token
) {

    if (!pool) {
        return;
    }

    await pool.query(
        `
        DELETE FROM sessions
        WHERE token = $1
        `,
        [token]
    );
}


/*
===========================================================
EXPORT
===========================================================
*/

module.exports = {
    databaseConfigured,
    initDatabase,
    migrateUsersFromJson,
    findUser,
    createUser,
    userExists,
    createSession,
    getUserFromSession,
    deleteSession
};