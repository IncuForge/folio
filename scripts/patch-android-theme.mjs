import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src-tauri/gen/android/app/src/main/res");
const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (entry.name === "styles.xml") files.push(target);
  }
}
walk(root);
const items = `
        <item name="android:windowDrawsSystemBarBackgrounds">true</item>
        <item name="android:windowTranslucentStatus">false</item>
        <item name="android:statusBarColor">#F8F7F4</item>
        <item name="android:navigationBarColor">#F8F7F4</item>
        <item name="android:windowLightStatusBar">true</item>
        <item name="android:windowLightNavigationBar">true</item>`;
for (const file of files) {
  let source = fs.readFileSync(file, "utf8");
  if (source.includes("android:windowLightStatusBar")) continue;
  source = source.replace(/(<style[^>]*name="AppTheme"[\s\S]*?)(\s*<\/style>)/, `$1${items}$2`);
  fs.writeFileSync(file, source);
}
console.log(`Patched Android system bars in ${files.length} resource file(s).`);