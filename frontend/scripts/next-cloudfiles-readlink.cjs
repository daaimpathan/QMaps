const fs = require("node:fs");
const path = require("node:path");

const outputDirectory = path.resolve(process.cwd(), ".next");
const originalReadlink = fs.promises.readlink.bind(fs.promises);

// Windows exposes OneDrive cloud placeholders as reparse points. Next.js
// classifies them as symlinks, but readlink() returns EINVAL for these files.
// During Next's generated-output cleanup, remove only that invalid entry and
// let the cleanup continue. Real symlinks and errors outside .next are intact.
if (process.platform === "win32") {
  fs.promises.readlink = async (target, options) => {
    try {
      return await originalReadlink(target, options);
    } catch (error) {
      if (error.code !== "EINVAL") throw error;

      const targetPath = Buffer.isBuffer(target) ? target.toString() : String(target);
      const absoluteTarget = path.resolve(targetPath);
      const relativeTarget = path.relative(outputDirectory, absoluteTarget);
      const isInsideOutput =
        relativeTarget !== "" &&
        relativeTarget !== ".." &&
        !relativeTarget.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relativeTarget);

      if (!isInsideOutput) throw error;

      const stats = await fs.promises.lstat(absoluteTarget);
      if (stats.isDirectory()) {
        await fs.promises.rmdir(absoluteTarget);
      } else {
        await fs.promises.unlink(absoluteTarget);
      }

      // Next recurses only when readlink returns a non-empty target.
      return "";
    }
  };
}
