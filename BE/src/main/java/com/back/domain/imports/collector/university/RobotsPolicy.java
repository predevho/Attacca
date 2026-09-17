package com.back.domain.imports.collector.university;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class RobotsPolicy {

    private final URI robotsUri;
    private final List<Group> groups;
    private final Decision fixedDecision;
    private final String reason;

    private RobotsPolicy(URI robotsUri, List<Group> groups, Decision fixedDecision, String reason) {
        this.robotsUri = robotsUri;
        this.groups = List.copyOf(groups);
        this.fixedDecision = fixedDecision;
        this.reason = reason;
    }

    public static RobotsPolicy parse(URI robotsUri, String body) {
        List<Group> groups = new ArrayList<>();
        Group current = null;
        boolean rulesStarted = false;
        for (String rawLine : body.split("\\R")) {
            String line = stripComment(rawLine).trim();
            if (line.isEmpty() || !line.contains(":")) {
                continue;
            }
            String key = line.substring(0, line.indexOf(':')).trim().toLowerCase(Locale.ROOT);
            String value = line.substring(line.indexOf(':') + 1).trim();
            if (key.equals("user-agent")) {
                if (current == null || rulesStarted) {
                    current = new Group(new ArrayList<>(), new ArrayList<>());
                    groups.add(current);
                    rulesStarted = false;
                }
                current.userAgents.add(value.toLowerCase(Locale.ROOT));
            } else if ((key.equals("allow") || key.equals("disallow")) && current != null) {
                rulesStarted = true;
                if (!value.isEmpty()) {
                    current.rules.add(new Rule(key.equals("allow"), value));
                }
            }
        }
        return new RobotsPolicy(robotsUri, groups, null, null);
    }

    public static RobotsPolicy allowAll(URI robotsUri) {
        return new RobotsPolicy(robotsUri, List.of(), Decision.ALLOW, "robots 4xx");
    }

    public static RobotsPolicy skipHost(URI robotsUri, String reason) {
        return new RobotsPolicy(robotsUri, List.of(), Decision.SKIP_HOST, reason);
    }

    public Decision evaluate(String userAgent, URI target) {
        if (fixedDecision != null) {
            return fixedDecision;
        }
        Group group = groupFor(userAgent);
        if (group == null) {
            return Decision.ALLOW;
        }
        String path = target.getRawPath();
        if (path == null || path.isBlank()) {
            path = "/";
        }
        Rule winner = null;
        for (Rule rule : group.rules) {
            if (path.startsWith(rule.path) && (winner == null
                    || rule.path.length() > winner.path.length()
                    || rule.path.length() == winner.path.length() && rule.allow && !winner.allow)) {
                winner = rule;
            }
        }
        return winner == null || winner.allow ? Decision.ALLOW : Decision.DISALLOW;
    }

    public String reason() {
        return reason;
    }

    public URI robotsUri() {
        return robotsUri;
    }

    private Group groupFor(String userAgent) {
        String token = userAgent == null ? "" : userAgent.toLowerCase(Locale.ROOT).split("[/\\s]", 2)[0];
        Group star = null;
        for (Group group : groups) {
            if (group.userAgents.contains(token)) {
                return group;
            }
            if (group.userAgents.contains("*")) {
                star = group;
            }
        }
        return star;
    }

    private static String stripComment(String line) {
        int index = line.indexOf('#');
        return index >= 0 ? line.substring(0, index) : line;
    }

    public enum Decision {
        ALLOW,
        DISALLOW,
        SKIP_HOST
    }

    private record Group(List<String> userAgents, List<Rule> rules) {
    }

    private record Rule(boolean allow, String path) {
    }
}
