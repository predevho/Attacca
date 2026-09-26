package com.back.domain.imports.collector.kopis;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlElementWrapper;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlProperty;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlRootElement;
import java.util.List;

@JacksonXmlRootElement(localName = "dbs")
public record KopisListResponse(
        @JacksonXmlProperty(localName = "db")
        @JacksonXmlElementWrapper(useWrapping = false)
        List<KopisListItem> items
) {

    public List<KopisListItem> items() {
        return items == null ? List.of() : items;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record KopisListItem(
            @JacksonXmlProperty(localName = "mt20id") String mt20id
    ) {
    }
}
