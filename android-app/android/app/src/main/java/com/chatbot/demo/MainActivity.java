package com.chatbot.demo;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeActivity;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 应用内更新（GitHub Releases 方案）：
 *  - window.NativeUpdater.checkGithub(repo) 请求 GitHub Releases API 检查最新版；
 *  - status() 轮询得到 {phase,versionCode,versionName,tag,notes,apkUrl,error,progress}；
 *    phase = idle/checking/available/uptodate/failed/downloading/installing
 *  - install(apkUrl) 下载 APK：先备份当前版本，下载后校验包名/签名/版本，
 *    校验通过才调起系统安装器覆盖安装；任一环节失败保留旧版本（天然回滚）；
 *  - rollback() 用备份的旧 APK 调起安装器，回退到上一版本；hasBackup() 查询备份是否存在。
 */
public class MainActivity extends BridgeActivity {

    private static final String DEFAULT_REPO = "xiguabusgua/chatbot";
    private static final String API_TEMPLATE =
        "https://api.github.com/repos/%s/releases/latest";
    private static final String BACKUP_NAME = "rollback-backup.apk";

    // 相册选图：请求码与权限
    private static final int REQ_PICK_IMAGE = 3001;
    private static final int REQ_READ_STORAGE = 3002;
    private static final int IMAGE_MAX_EDGE = 1280;

    private final AtomicReference<String> updateStatus =
        new AtomicReference<>("{\"phase\":\"idle\"}");

    /** 相册回调 JS 函数名，由页面 pick() 时传入 */
    private String galleryCallback = null;

    private void setStatus(String s) {
        updateStatus.set(s);
    }

    private void setStatusSafe(JSONObject s) {
        try {
            setStatus(s.toString());
        } catch (Exception ignored) {
        }
    }

    private void fail(String code, String message) {
        try {
            JSONObject s = new JSONObject();
            s.put("phase", "failed");
            s.put("error", code);
            s.put("message", message == null ? "" : message);
            setStatusSafe(s);
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            webView.addJavascriptInterface(new Updater(), "NativeUpdater");
            webView.addJavascriptInterface(new Gallery(), "NativeGallery");
        }
    }

    /* ---------------- 相册选图 ---------------- */

    /** 通知 H5 相册结果：{ok:true,data:<base64>} 或 {ok:false,reason:cancel|permission|error} */
    private void galleryResult(final boolean ok, final String data, final String reason) {
        if (galleryCallback == null || galleryCallback.trim().isEmpty()) return;
        final String cb = galleryCallback;
        galleryCallback = null;
        runOnUiThread(() -> {
            WebView wv = getBridge() != null ? getBridge().getWebView() : null;
            if (wv == null) return;
            StringBuilder sb = new StringBuilder("{");
            sb.append("\"ok\":").append(ok ? "true" : "false");
            if (ok) {
                sb.append(",\"data\":").append(jsonString(data == null ? "" : data));
            } else {
                sb.append(",\"reason\":").append(jsonString(reason == null ? "error" : reason));
            }
            sb.append("}");
            wv.evaluateJavascript("try{" + cb + "(" + sb + ")}catch(e){}", null);
        });
    }

    private static String jsonString(String s) {
        JSONObject o = new JSONObject();
        try {
            o.put("v", s == null ? "" : s);
            String raw = o.toString();
            return raw.substring(raw.indexOf(':') + 1, raw.length() - 1);
        } catch (Exception e) {
            return "\"\"";
        }
    }

    private boolean hasStoragePermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return ContextCompat.checkSelfPermission(this,
                android.Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED;
        }
        return ContextCompat.checkSelfPermission(this,
            android.Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestStoragePermission() {
        String[] perms = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            ? new String[]{android.Manifest.permission.READ_MEDIA_IMAGES}
            : new String[]{android.Manifest.permission.READ_EXTERNAL_STORAGE};
        ActivityCompat.requestPermissions(this, perms, REQ_READ_STORAGE);
    }

    private void openGallery() {
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Android 13+ 系统照片选择器，无需存储权限
            intent = new Intent(android.provider.MediaStore.ACTION_PICK_IMAGES);
            intent.setType("image/*");
        } else {
            intent = new Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI);
            intent.setType("image/*");
        }
        try {
            startActivityForResult(intent, REQ_PICK_IMAGE);
        } catch (Exception e) {
            galleryResult(false, null, "error");
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_READ_STORAGE) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (granted) openGallery();
            else galleryResult(false, null, "permission");
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_PICK_IMAGE) return;
        if (resultCode != RESULT_OK || data == null || data.getData() == null) {
            galleryResult(false, null, "cancel");
            return;
        }
        try {
            Bitmap bmp = decodeScaled(data.getData());
            if (bmp == null) {
                galleryResult(false, null, "error");
                return;
            }
            java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
            bmp.compress(Bitmap.CompressFormat.JPEG, 72, bos);
            bmp.recycle();
            String b64 = android.util.Base64.encodeToString(bos.toByteArray(), android.util.Base64.NO_WRAP);
            galleryResult(true, b64, null);
        } catch (Exception e) {
            galleryResult(false, null, "error");
        }
    }

    /** 按最大边缩放解码，防 OOM 并控制体积 */
    private Bitmap decodeScaled(Uri uri) throws Exception {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        InputStream in = getContentResolver().openInputStream(uri);
        if (in == null) return null;
        BitmapFactory.decodeStream(in, null, bounds);
        in.close();
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;
        int sample = Math.max(1, Math.max(bounds.outWidth, bounds.outHeight) / IMAGE_MAX_EDGE);
        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inSampleSize = sample;
        opts.inPreferredConfig = Bitmap.Config.RGB_565;
        InputStream in2 = getContentResolver().openInputStream(uri);
        if (in2 == null) return null;
        Bitmap bmp = BitmapFactory.decodeStream(in2, null, opts);
        in2.close();
        return bmp;
    }

    private class Gallery {
        /** pick(callbackName)：拉起相册，结果回调 window[callbackName]({ok,...}) */
        @JavascriptInterface
        public void pick(final String callbackName) {
            galleryCallback = callbackName;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                openGallery(); // 系统照片选择器无需权限
            } else if (hasStoragePermission()) {
                openGallery();
            } else {
                requestStoragePermission();
            }
        }
    }

    /** 返回键先交给页面处理面板关闭，返回 "1" 表示已消费。 */
    @Override
    public void onBackPressed() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript(
            "(function(){try{return window.__skHandleBack&&window.__skHandleBack()?1:0}catch(e){return 0}})()",
            value -> {
                if (!"1".equals(value)) {
                    MainActivity.super.onBackPressed();
                }
            }
        );
    }

    private int selfVersionCode() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
        } catch (Exception e) {
            return 0;
        }
    }

    private String selfVersionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "";
        }
    }

    private File backupFile() {
        return new File(getCacheDir(), BACKUP_NAME);
    }

    /** 把当前正在运行的 APK 备份到缓存目录，供回滚使用。 */
    private void backupCurrentApk() {
        try {
            String path = getPackageCodePath();
            File src = new File(path);
            File dst = backupFile();
            if (!src.exists()) return;
            copyFile(src, dst);
        } catch (Exception ignored) {
        }
    }

    private void copyFile(File src, File dst) throws Exception {
        InputStream in = new FileInputStream(src);
        OutputStream out = new FileOutputStream(dst);
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        out.flush();
        out.close();
        in.close();
    }

    /** 取 APK 的签名证书指纹（SHA-256），用于校验更新包与当前应用同源。 */
    private String apkSignDigest(File apk) {
        try {
            PackageInfo pi = getPackageManager()
                .getPackageArchiveInfo(apk.getAbsolutePath(), PackageManager.GET_SIGNATURES);
            if (pi == null || pi.signatures == null || pi.signatures.length == 0) return null;
            Signature sig = pi.signatures[0];
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(sig.toByteArray());
            StringBuilder sb = new StringBuilder();
            for (byte b : d) sb.append(String.format(Locale.US, "%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }

    private String selfSignDigest() {
        try {
            PackageInfo pi = getPackageManager()
                .getPackageInfo(getPackageName(), PackageManager.GET_SIGNATURES);
            if (pi.signatures == null || pi.signatures.length == 0) return null;
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(pi.signatures[0].toByteArray());
            StringBuilder sb = new StringBuilder();
            for (byte b : d) sb.append(String.format(Locale.US, "%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }

    /** 校验下载包：可解析、包名一致、签名一致、versionCode 不低于当前。 */
    private String validateApk(File apk) {
        try {
            PackageInfo pi = getPackageManager()
                .getPackageArchiveInfo(apk.getAbsolutePath(), PackageManager.GET_SIGNATURES);
            if (pi == null || pi.packageName == null) return "invalid-package";
            if (!pi.packageName.equals(getPackageName())) return "package-mismatch";
            if (pi.versionCode < selfVersionCode()) return "downgrade";
            String a = apkSignDigest(apk);
            String b = selfSignDigest();
            if (a != null && b != null && !a.equals(b)) return "signature-mismatch";
            return null;
        } catch (Exception e) {
            return "invalid-package";
        }
    }

    private String fetchText(String urlStr) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(urlStr).openConnection();
        c.setConnectTimeout(10000);
        c.setReadTimeout(20000);
        c.setRequestProperty("User-Agent", "chatbot-updater/1.0");
        c.setRequestProperty("Accept", "application/vnd.github+json");
        try {
            int code = c.getResponseCode();
            if (code >= 300) throw new Exception("HTTP " + code);
            InputStream in = c.getInputStream();
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
            in.close();
            return bo.toString("UTF-8");
        } finally {
            c.disconnect();
        }
    }

    /** 从 tag（如 v45、0.1.1-v45）中提取末尾的版本号数字。 */
    private int parseCode(String tag) {
        if (tag == null) return 0;
        java.util.regex.Matcher m =
            java.util.regex.Pattern.compile("(\\d+)").matcher(tag);
        int last = 0;
        while (m.find()) {
            try {
                last = Integer.parseInt(m.group(1));
            } catch (Exception ignored) {
            }
        }
        return last;
    }

    private void fireInstall(final File apk) {
        runOnUiThread(() -> {
            try {
                Uri uri = FileProvider.getUriForFile(
                    MainActivity.this, getPackageName() + ".fileprovider", apk);
                Intent i = new Intent(Intent.ACTION_VIEW);
                i.setDataAndType(uri, "application/vnd.android.package-archive");
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                        && !getPackageManager().canRequestPackageInstalls()) {
                    fail("install-permission", "unknown sources not granted");
                    try {
                        Intent g = new Intent(
                            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                            Uri.parse("package:" + getPackageName()));
                        g.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(g);
                    } catch (Exception ignored) {
                    }
                    return;
                }
                startActivity(i);
                setStatus("{\"phase\":\"installing\"}");
            } catch (Exception e) {
                fail("install-failed", e.getMessage());
            }
        });
    }

    private class Updater {

        @JavascriptInterface
        public String status() {
            return updateStatus.get();
        }

        /** 检查 GitHub 最新 Release。repo 为空时用默认仓库。 */
        @JavascriptInterface
        public void checkGithub(final String repo) {
            checkManifest(String.format(API_TEMPLATE,
                (repo == null || repo.trim().isEmpty()) ? DEFAULT_REPO : repo.trim()), true);
        }

        /** 兼容旧方案：检查自定义 update.json 清单。 */
        @JavascriptInterface
        public void check(String manifestUrl) {
            checkManifest(manifestUrl, false);
        }

        private void checkManifest(final String url, final boolean github) {
            setStatus("{\"phase\":\"checking\"}");
            new Thread(() -> {
                try {
                    String text = fetchText(url);
                    JSONObject root = new JSONObject(text);
                    int remote;
                    String apkUrl;
                    String notes;
                    String versionName;
                    String tag;
                    if (github) {
                        tag = root.optString("tag_name", "");
                        remote = parseCode(tag);
                        notes = root.optString("body", "");
                        versionName = root.optString("name", tag);
                        JSONArray assets = root.optJSONArray("assets");
                        apkUrl = "";
                        if (assets != null) {
                            for (int i = 0; i < assets.length(); i++) {
                                JSONObject a = assets.getJSONObject(i);
                                String name = a.optString("name", "");
                                if (name.toLowerCase(Locale.US).endsWith(".apk")) {
                                    apkUrl = a.optString("browser_download_url", "");
                                    break;
                                }
                            }
                        }
                    } else {
                        remote = root.optInt("versionCode", 0);
                        apkUrl = root.optString("apkUrl", "");
                        notes = root.optString("notes", "");
                        versionName = root.optString("versionName", "");
                        tag = "";
                    }
                    JSONObject s = new JSONObject();
                    if (remote > selfVersionCode() && !apkUrl.isEmpty()) {
                        s.put("phase", "available");
                        s.put("versionCode", remote);
                        s.put("versionName", versionName);
                        s.put("tag", tag);
                        s.put("apkUrl", apkUrl);
                        s.put("notes", notes);
                        s.put("localCode", selfVersionCode());
                    } else {
                        s.put("phase", "uptodate");
                        s.put("versionCode", remote);
                        s.put("localCode", selfVersionCode());
                    }
                    setStatusSafe(s);
                } catch (Exception e) {
                    fail("network", e.getMessage());
                }
            }).start();
        }

        /** 下载 APK，校验通过后安装；失败时清理临时包并保留旧版本。 */
        @JavascriptInterface
        public void install(final String apkUrl) {
            if (apkUrl == null || apkUrl.isEmpty()) {
                fail("invalid-url", "empty apk url");
                return;
            }
            setStatus("{\"phase\":\"downloading\",\"progress\":0}");
            new Thread(() -> {
                HttpURLConnection c = null;
                File out = null;
                try {
                    c = (HttpURLConnection) new URL(apkUrl).openConnection();
                    c.setConnectTimeout(15000);
                    c.setReadTimeout(90000);
                    c.setInstanceFollowRedirects(true);
                    c.setRequestProperty("User-Agent", "chatbot-updater/1.0");
                    int code = c.getResponseCode();
                    if (code >= 300) throw new Exception("HTTP " + code);
                    long total = c.getContentLengthLong();
                    InputStream in = c.getInputStream();
                    out = new File(getCacheDir(), "update-" + System.currentTimeMillis() + ".apk");
                    OutputStream fo = new FileOutputStream(out);
                    byte[] buf = new byte[16384];
                    long done = 0;
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        fo.write(buf, 0, n);
                        done += n;
                        if (total > 0) {
                            int p = (int) (done * 100 / total);
                            JSONObject s = new JSONObject();
                            s.put("phase", "downloading");
                            s.put("progress", p);
                            setStatusSafe(s);
                        }
                    }
                    fo.flush();
                    fo.close();
                    in.close();

                    String problem = validateApk(out);
                    if (problem != null) {
                        if (out.exists()) out.delete();
                        fail(problem, "validation failed");
                        return;
                    }

                    // 安装前备份当前版本，供回滚使用
                    backupCurrentApk();
                    fireInstall(out);
                } catch (Exception e) {
                    if (out != null && out.exists()) out.delete();
                    fail("download", e.getMessage());
                } finally {
                    if (c != null) c.disconnect();
                }
            }).start();
        }

        @JavascriptInterface
        public String hasBackup() {
            File f = backupFile();
            return (f != null && f.exists() && f.length() > 0) ? "1" : "0";
        }

        /** 回滚：用备份的旧 APK 调起安装器。 */
        @JavascriptInterface
        public void rollback() {
            File f = backupFile();
            if (f == null || !f.exists()) {
                fail("no-backup", "no backup apk");
                return;
            }
            fireInstall(f);
        }
    }
}
