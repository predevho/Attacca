package com.back.domain.imports.collector.kopis;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlElementWrapper;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlProperty;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlRootElement;
import java.util.List;

@JacksonXmlRootElement(localName = "dbs")
public record KopisDetailResponse(
        @JacksonXmlProperty(localName = "db")
        @JacksonXmlElementWrapper(useWrapping = false)
        List<KopisDetailItem> items
) {

    public KopisDetailItem firstItem() {
        return items == null || items.isEmpty() ? null : items.get(0);
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record KopisDetailItem(
            @JacksonXmlProperty(localName = "mt20id") String mt20id,
            @JacksonXmlProperty(localName = "prfnm") String prfnm,
            @JacksonXmlProperty(localName = "prfpdfrom") String prfpdfrom,
            @JacksonXmlProperty(localName = "prfpdto") String prfpdto,
            @JacksonXmlProperty(localName = "fcltynm") String fcltynm,
            @JacksonXmlProperty(localName = "prfcast") String prfcast,
            @JacksonXmlProperty(localName = "pcseguidance") String pcseguidance,
            @JacksonXmlProperty(localName = "dtguidance") String dtguidance,
            @JacksonXmlProperty(localName = "prfruntime") String prfruntime,
            @JacksonXmlProperty(localName = "poster") String poster,
            @JacksonXmlProperty(localName = "relates") Relates relates
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Relates(
            @JacksonXmlProperty(localName = "relate")
            @JacksonXmlElementWrapper(useWrapping = false)
            List<Relate> items
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Relate(
            @JacksonXmlProperty(localName = "relatenm") String relatenm,
            @JacksonXmlProperty(localName = "relateurl") String relateurl
    ) {
    }
}
