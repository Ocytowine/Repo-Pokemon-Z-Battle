package fr.ocytowine.pokemonzbattle;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.PriorityQueue;

/** Searches only a directory tree explicitly granted by the Android document picker. */
@CapacitorPlugin(name = "SourceSaveLocator")
public class SourceSaveLocatorPlugin extends Plugin {
    private static final int MAX_VISITED = 8000;
    private static final int MAX_DEPTH = 12;
    private static final int MAX_FILE_BYTES = 4 * 1024 * 1024;

    private static class Folder {
        final String documentId;
        final String path;
        final int depth;
        Folder(String documentId, String path, int depth) {
            this.documentId = documentId; this.path = path; this.depth = depth;
        }
    }
    private static class Candidate {
        final String name;
        final String path;
        final String uri;
        final long size;
        final int score;
        Candidate(String name, String path, String uri, long size, int score) {
            this.name = name; this.path = path; this.uri = uri; this.size = size; this.score = score;
        }
    }
    private static class SearchResult {
        final List<Candidate> candidates;
        final boolean limited;
        SearchResult(List<Candidate> candidates, boolean limited) {
            this.candidates = candidates; this.limited = limited;
        }
    }

    @PluginMethod
    public void searchFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "onFolderSelected");
    }

    @ActivityCallback
    private void onFolderSelected(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null
            || result.getData().getData() == null) {
            call.reject("Recherche annulée.");
            return;
        }
        Uri tree = result.getData().getData();
        try {
            getContext().getContentResolver().takePersistableUriPermission(tree,
                Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (SecurityException ignored) {
            // The current picker grant still permits this one search.
        }
        getBridge().execute(() -> {
            try {
                SearchResult resultFound = search(tree);
                List<Candidate> candidates = resultFound.candidates;
                JSArray found = new JSArray();
                for (int index = 0; index < Math.min(30, candidates.size()); index++) {
                    Candidate candidate = candidates.get(index);
                    JSObject entry = new JSObject();
                    entry.put("name", candidate.name);
                    entry.put("path", candidate.path);
                    entry.put("uri", candidate.uri);
                    entry.put("size", candidate.size);
                    found.put(entry);
                }
                JSObject response = new JSObject();
                response.put("candidates", found);
                response.put("limited", resultFound.limited || candidates.size() > 30);
                call.resolve(response);
            } catch (Exception error) {
                call.reject("Recherche impossible dans ce dossier : " + error.getMessage());
            }
        });
    }

    private SearchResult search(Uri tree) {
        PriorityQueue<Folder> folders = new PriorityQueue<>(
            Comparator.comparingInt((Folder folder) -> score(folder.path, "")).reversed()
                .thenComparingInt(folder -> folder.depth).thenComparing(folder -> folder.path));
        folders.add(new Folder(DocumentsContract.getTreeDocumentId(tree), "", 0));
        List<Candidate> found = new ArrayList<>();
        int visited = 0;
        boolean limited = false;
        searchLoop: while (!folders.isEmpty()) {
            Folder folder = folders.remove();
            Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, folder.documentId);
            String[] columns = { DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_SIZE };
            try (Cursor cursor = getContext().getContentResolver().query(children, columns, null, null, null)) {
                if (cursor == null) continue;
                while (cursor.moveToNext()) {
                    if (++visited > MAX_VISITED) { limited = true; break searchLoop; }
                    String id = cursor.getString(0);
                    String name = cursor.getString(1);
                    String mime = cursor.getString(2);
                    long size = cursor.isNull(3) ? -1 : cursor.getLong(3);
                    if (id == null || name == null) continue;
                    String path = folder.path.isEmpty() ? name : folder.path + "/" + name;
                    if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) {
                        if (folder.depth < MAX_DEPTH && !isResourceDirectory(name)) {
                            folders.add(new Folder(id, path, folder.depth + 1));
                        }
                    } else if (name.matches("(?i)^Game(?:_[0-9]+)?(?:_autosave)?\\.rxdata$")
                        && size <= MAX_FILE_BYTES) {
                        Uri file = DocumentsContract.buildDocumentUriUsingTree(tree, id);
                        found.add(new Candidate(name, path, file.toString(), size, score(path, name)));
                    }
                }
            }
        }
        found.sort(Comparator.comparingInt((Candidate candidate) -> candidate.score).reversed()
            .thenComparing(candidate -> candidate.path));
        return new SearchResult(found, limited);
    }

    private static boolean isResourceDirectory(String name) {
        String lower = name.toLowerCase(Locale.ROOT);
        return lower.equals("audio") || lower.equals("graphics") || lower.equals("data")
            || lower.equals("fonts") || lower.equals("pbs") || lower.equals("movies")
            || lower.equals("plugins");
    }

    private static int score(String path, String name) {
        String normalized = Normalizer.normalize(path, Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
        int value = normalized.contains("pokemon z") ? 100
            : normalized.contains("pokemon") ? 30 : 0;
        if (normalized.contains("v2.12")) value += 40;
        if (normalized.contains("francais")) value += 20;
        if (name.equalsIgnoreCase("Game.rxdata")) value += 10;
        if (normalized.contains("save")) value += 5;
        return value;
    }

    @PluginMethod
    public void readSave(PluginCall call) {
        String uriText = call.getString("uri");
        if (uriText == null || !uriText.startsWith("content://")) {
            call.reject("Fichier sélectionné invalide.");
            return;
        }
        getBridge().execute(() -> {
            try (InputStream input = getContext().getContentResolver().openInputStream(Uri.parse(uriText));
                ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                if (input == null) throw new IllegalStateException("fichier inaccessible");
                byte[] buffer = new byte[16384];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    if (output.size() + read > MAX_FILE_BYTES) throw new IllegalStateException("fichier trop volumineux");
                    output.write(buffer, 0, read);
                }
                JSObject response = new JSObject();
                response.put("base64", Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP));
                call.resolve(response);
            } catch (Exception error) {
                call.reject("Lecture de la sauvegarde impossible : " + error.getMessage());
            }
        });
    }
}
