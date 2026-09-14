package com.back.domain.imports.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class PosterDownloader {
    static final int MAX_BYTES = 10 * 1024 * 1024;
    private final List<String> allowedHosts;

    public PosterDownloader(com.back.domain.imports.config.ImportProperties properties) {
        this.allowedHosts = properties.kopis().posterAllowedHosts().stream()
                .map(String::toLowerCase).toList();
    }

    public DownloadedPoster download(String rawUrl) {
        try {
            URI uri = URI.create(rawUrl);
            for (int redirect = 0; redirect < 6; redirect++) {
                validateHost(uri);
                HttpURLConnection connection = (HttpURLConnection) uri.toURL().openConnection();
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(10000);
                connection.setRequestProperty("User-Agent", "AttaccaBot/1.0");
                int status = connection.getResponseCode();
                if (status / 100 == 3) {
                    String location = connection.getHeaderField("Location");
                    if (location == null) return null;
                    uri = uri.resolve(location);
                    continue;
                }
                if (status < 200 || status >= 300) return null;
                String contentType = connection.getContentType();
                if (contentType == null || !contentType.toLowerCase().startsWith("image/")) return null;
                long length = connection.getContentLengthLong();
                if (length > MAX_BYTES) return null;
                try (var input = connection.getInputStream(); var output = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[8192];
                    int read;
                    int total = 0;
                    while ((read = input.read(buffer)) != -1) {
                        total += read;
                        if (total > MAX_BYTES) return null;
                        output.write(buffer, 0, read);
                    }
                    return new DownloadedPoster(output.toByteArray(), contentType.split(";", 2)[0],
                            fileName(uri, contentType));
                }
            }
        } catch (IOException | IllegalArgumentException e) {
            return null;
        }
        return null;
    }

    private void validateHost(URI uri) {
        if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                || uri.getHost() == null || !allowedHosts.contains(uri.getHost().toLowerCase())) {
            throw new IllegalArgumentException("Poster host is not allowed");
        }
    }

    private String fileName(URI uri, String contentType) {
        String path = uri.getPath();
        if (path != null && path.contains("/")) {
            String name = path.substring(path.lastIndexOf('/') + 1);
            if (!name.isBlank() && name.length() <= 200) return name;
        }
        return "poster." + contentType.substring(contentType.indexOf('/') + 1).replaceAll("[^a-zA-Z0-9]", "");
    }

    public record DownloadedPoster(byte[] content, String contentType, String originalName) {}
}
