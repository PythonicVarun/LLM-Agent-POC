const fs = require("fs");
const path = require("path");

const STATIC_DIR = path.resolve(__dirname, "..", "static");

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

(function main() {
    if (!fs.existsSync(STATIC_DIR)) {
        console.error("Static directory not found:", STATIC_DIR);
        process.exit(1);
    }

    const allFiles = walk(STATIC_DIR);
    const bakFiles = allFiles.filter((f) => f.endsWith(".bak"));

    if (!bakFiles.length) {
        console.log("No .bak files found under", STATIC_DIR);
        return;
    }

    console.log("Applying restore of" + ` ${bakFiles.length} files:`);
    bakFiles.forEach((b) => {
        const orig = b.slice(0, -4);
        console.log(" ->", orig);
    });

    let restored = 0;
    bakFiles.forEach((b) => {
        const orig = b.slice(0, -4);
        try {
            fs.copyFileSync(b, orig);
            restored++;
            fs.unlinkSync(b); // remove backup after restore
        } catch (err) {
            console.error(
                "Failed to restore",
                orig,
                err && err.message ? err.message : err,
            );
        }
    });

    console.log(`Restored ${restored}/${bakFiles.length} files.`);
})();
