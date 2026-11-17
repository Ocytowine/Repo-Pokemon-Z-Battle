package fr.ocytowine.pokemonzbattle;

import static org.junit.Assert.*;
import org.junit.Test;

public class PrivateApkUpdateRequestTest {
    private static final String SHA = "a".repeat(64);
    private static final String URL = "https://pokemon-z-battle-mobile.mimidu33-eb.workers.dev/api/updates/download/12";

    @Test public void acceptsOnlyTheVersionedWorkerRoute() {
        PrivateApkUpdateRequest request = PrivateApkUpdateRequest.parse(URL, 12, 392729346L, SHA);
        assertEquals(12, request.versionCode);
        assertEquals(392729346L, request.sizeBytes);
        assertEquals(URL, request.url);
    }

    @Test public void rejectsOtherHostsOrVersions() {
        for (String url : new String[] { "https://evil.example/api/updates/download/12",
            "http://pokemon-z-battle-mobile.mimidu33-eb.workers.dev/api/updates/download/12",
            URL + "?next=evil", URL.replace("/12", "/13") }) {
            try { PrivateApkUpdateRequest.parse(url, 12, 392729346L, SHA); fail(url); }
            catch (IllegalArgumentException expected) { }
        }
    }

    @Test public void validatesResumeRange() {
        assertTrue(PrivateApkUpdateRequest.matchesRange("bytes 100-999/1000", 100, 1000));
        assertFalse(PrivateApkUpdateRequest.matchesRange("bytes 0-999/1000", 100, 1000));
    }

    @Test public void acceptsCapacitorIntegerSizesWithoutLosingLongSizes() {
        assertEquals(Long.valueOf(392752498L), PrivateApkUpdateRequest.wholeNumber(392752498));
        assertEquals(Long.valueOf(3000000000L), PrivateApkUpdateRequest.wholeNumber(3000000000L));
        assertNull(PrivateApkUpdateRequest.wholeNumber(392752498.5));
        assertNull(PrivateApkUpdateRequest.wholeNumber("392752498"));
    }
}
