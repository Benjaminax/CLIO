package com.designclio.readingplatform;

import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Locale;

@CapacitorPlugin(name = "DownloadedFiles")
public class DownloadedFilesPlugin extends Plugin {
    private static final String RELATIVE_DIRECTORY = Environment.DIRECTORY_DOWNLOADS + "/CLIO/";

    @PluginMethod
    public void saveFile(PluginCall call) {
        String name = call.getString("name");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String data = call.getString("data");
        if (name == null || name.trim().isEmpty() || data == null) {
            call.reject("A file name and file data are required.");
            return;
        }

        String safeName = sanitizeFileName(name);
        byte[] bytes;
        try {
            bytes = Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException error) {
            call.reject("The downloaded file data is invalid.", error);
            return;
        }

        Uri fileUri = null;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
                values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                values.put(MediaStore.Downloads.RELATIVE_PATH, RELATIVE_DIRECTORY);
                values.put(MediaStore.Downloads.IS_PENDING, 1);
                fileUri = getContext().getContentResolver().insert(
                        MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (fileUri == null) throw new IllegalStateException("Android could not create the downloaded file.");

                try (OutputStream output = getContext().getContentResolver().openOutputStream(fileUri)) {
                    if (output == null) throw new IllegalStateException("Android could not write the downloaded file.");
                    output.write(bytes);
                }
                ContentValues ready = new ContentValues();
                ready.put(MediaStore.Downloads.IS_PENDING, 0);
                getContext().getContentResolver().update(fileUri, ready, null, null);
            } else {
                File root = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (root == null) throw new IllegalStateException("Android downloads storage is unavailable.");
                File directory = new File(root, "CLIO");
                if (!directory.exists() && !directory.mkdirs()) {
                    throw new IllegalStateException("Unable to create the CLIO downloads directory.");
                }
                File outputFile = new File(directory, safeName);
                try (FileOutputStream output = new FileOutputStream(outputFile)) {
                    output.write(bytes);
                }
                fileUri = FileProvider.getUriForFile(
                        getContext(), getContext().getPackageName() + ".fileprovider", outputFile);
            }

            JSObject result = describeFile(fileUri, safeName, mimeType, bytes.length,
                    System.currentTimeMillis() / 1000L);
            call.resolve(result);
        } catch (Exception error) {
            if (fileUri != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                getContext().getContentResolver().delete(fileUri, null, null);
            }
            call.reject("Unable to save the converted file to Downloads/CLIO.", error);
        }
    }

    @PluginMethod
    public void listFiles(PluginCall call) {
        JSArray files = new JSArray();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                String[] projection = {
                        MediaStore.Downloads._ID,
                        MediaStore.Downloads.DISPLAY_NAME,
                        MediaStore.Downloads.MIME_TYPE,
                        MediaStore.Downloads.SIZE,
                        MediaStore.Downloads.DATE_MODIFIED
                };
                try (Cursor cursor = getContext().getContentResolver().query(
                        MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                        projection,
                        MediaStore.Downloads.RELATIVE_PATH + "=?",
                        new String[]{RELATIVE_DIRECTORY},
                        MediaStore.Downloads.DATE_MODIFIED + " DESC")) {
                    if (cursor != null) {
                        while (cursor.moveToNext()) {
                            long id = cursor.getLong(0);
                            String name = cursor.getString(1);
                            String mimeType = cursor.getString(2);
                            long size = cursor.getLong(3);
                            long modifiedAt = cursor.getLong(4);
                            Uri uri = ContentUris.withAppendedId(
                                    MediaStore.Downloads.EXTERNAL_CONTENT_URI, id);
                            files.put(describeFile(uri, name, mimeType, size, modifiedAt));
                        }
                    }
                }
            } else {
                File root = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                File directory = root == null ? null : new File(root, "CLIO");
                File[] storedFiles = directory == null ? null : directory.listFiles(File::isFile);
                if (storedFiles != null) {
                    for (File file : storedFiles) {
                        Uri uri = FileProvider.getUriForFile(
                                getContext(), getContext().getPackageName() + ".fileprovider", file);
                        files.put(describeFile(uri, file.getName(), mimeTypeFor(file.getName()),
                                file.length(), file.lastModified() / 1000L));
                    }
                }
            }
            JSObject result = new JSObject();
            result.put("files", files);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Unable to read downloaded files.", error);
        }
    }

    @PluginMethod
    public void readFile(PluginCall call) {
        Uri uri = fileUriFromCall(call);
        if (uri == null) return;
        try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
            if (input == null) throw new IllegalStateException("The downloaded file is unavailable.");
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            JSObject result = new JSObject();
            result.put("data", Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP));
            result.put("mimeType", getMimeType(uri));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Unable to read the downloaded file.", error);
        }
    }

    @PluginMethod
    public void openFile(PluginCall call) {
        Uri uri = fileUriFromCall(call);
        if (uri == null) return;
        try {
            Intent viewIntent = new Intent(Intent.ACTION_VIEW);
            viewIntent.setDataAndType(uri, getMimeType(uri));
            viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(viewIntent, "Open downloaded file"));
            call.resolve();
        } catch (Exception error) {
            call.reject("No installed app can open this file type.", error);
        }
    }

    @PluginMethod
    public void deleteFile(PluginCall call) {
        Uri uri = fileUriFromCall(call);
        if (uri == null) return;
        try {
            if (getContext().getContentResolver().delete(uri, null, null) == 0) {
                throw new IllegalStateException("The downloaded file no longer exists.");
            }
            call.resolve();
        } catch (Exception error) {
            call.reject("Unable to delete the downloaded file.", error);
        }
    }

    private Uri fileUriFromCall(PluginCall call) {
        String value = call.getString("id");
        if (value == null || value.isEmpty()) {
            call.reject("A downloaded file identifier is required.");
            return null;
        }
        try {
            return Uri.parse(value);
        } catch (Exception error) {
            call.reject("The downloaded file identifier is invalid.", error);
            return null;
        }
    }

    private JSObject describeFile(Uri uri, String name, String mimeType, long size, long modifiedAt) {
        JSObject file = new JSObject();
        String path = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? "Downloads/CLIO/" + name
                : new File(getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "CLIO/" + name).getAbsolutePath();
        file.put("id", uri.toString());
        file.put("name", name);
        file.put("mimeType", mimeType == null ? "application/octet-stream" : mimeType);
        file.put("path", path);
        file.put("size", size);
        file.put("modifiedAt", modifiedAt * 1000L);
        return file;
    }

    private String getMimeType(Uri uri) {
        String mimeType = getContext().getContentResolver().getType(uri);
        return mimeType == null ? "application/octet-stream" : mimeType;
    }

    private String sanitizeFileName(String name) {
        String safe = name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        while (safe.startsWith(".")) safe = safe.substring(1);
        return safe.isEmpty() ? "converted-file" : safe;
    }

    private String mimeTypeFor(String name) {
        String lower = name.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (lower.endsWith(".epub")) return "application/epub+zip";
        if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
        if (lower.endsWith(".md")) return "text/markdown";
        if (lower.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }
}
