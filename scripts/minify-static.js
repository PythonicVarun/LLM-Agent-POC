const fs = require("fs");
const path = require("path");
const { minify } = require("minify");
const UglifyJS = require("uglify-js");

const STATIC_DIR = path.resolve(__dirname, "..", "static");
const BACKUP_EXT = ".bak";
const LOG_FILE = path.resolve(__dirname, "minify-static.log");
const ALLOWED_TEXT_EXT = [".html", ".htm", ".css", ".js"];

function appendLog(line) {
    fs.appendFileSync(LOG_FILE, line + "\n", "utf8");
}

async function minifyFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_TEXT_EXT.includes(ext))
        return { skipped: true, reason: "unsupported-ext" };
    const base = path.basename(filePath).toLowerCase();
    if (base.includes(".min.") || base.endsWith(".min" + ext))
        return { skipped: true, reason: "already-minified" };
    try {
        console.log("Minifying:", filePath);
        let minified;

        if (base.endsWith(".js"))
            minified = UglifyJS.minify(fs.readFileSync(filePath, "utf8")).code;
        else minified = await minify(filePath);

        if (!minified) return { skipped: true, reason: "empty-minified" };
        // backup original
        fs.copyFileSync(filePath, filePath + BACKUP_EXT);
        fs.writeFileSync(filePath, minified, "utf8");
        return { skipped: false };
    } catch (err) {
        return { skipped: true, error: err };
    }
}

function walk(dir) {
    const results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function (file) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results.push(...walk(filePath));
        } else {
            results.push(filePath);
        }
    });
    return results;
}

(async function main() {
    // start fresh log
    try {
        fs.unlinkSync(LOG_FILE);
    } catch (e) {}
    appendLog("Minify run: " + new Date().toISOString());
    appendLog("Scanning: " + STATIC_DIR);
    console.log("Minify: scanning", STATIC_DIR);
    if (!fs.existsSync(STATIC_DIR)) {
        console.error("Static directory not found:", STATIC_DIR);
        process.exit(1);
    }

    const files = walk(STATIC_DIR);
    let minifiedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const f of files) {
        const res = await minifyFile(f);
        if (res.error) {
            console.log(res.error);
            errors.push({
                file: f,
                error: res.error.message || res.error.toString(),
            });
            appendLog(
                `ERROR ${f}: ${res.error && res.error.message ? res.error.message : res.error}`,
            );
        } else if (res.skipped) {
            skippedCount++;
            appendLog(`SKIP ${f}: ${res.reason || "skip"}`);
        } else {
            minifiedCount++;
            appendLog(`MINIFIED ${f}`);
        }
    }

    const summary = `Minify: done. minified=${minifiedCount}, skipped=${skippedCount}, errors=${errors.length}`;
    console.log(summary);
    appendLog(summary);
    if (errors.length) {
        appendLog("Errors:");
        errors.forEach((e) => appendLog(`${e.file} -> ${e.error}`));
        console.error("Minify encountered errors. See", LOG_FILE);
        process.exit(2);
    }

    process.exit(0);
})();
