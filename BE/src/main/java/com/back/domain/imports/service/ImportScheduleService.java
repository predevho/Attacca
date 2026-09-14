package com.back.domain.imports.service;

import com.back.domain.imports.entity.ImportRun;
import com.back.domain.imports.entity.ImportSource;
import com.back.domain.imports.entity.ImportTrigger;
import com.back.domain.imports.repository.ImportRunRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.Executor;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class ImportScheduleService {
    private final ImportRunService runService;
    private final ImportRunRepository runRepository;
    private final Clock clock;
    private final Executor executor;

    public ImportScheduleService(ImportRunService runService, ImportRunRepository runRepository,
            Clock clock, @Qualifier("importExecutor") Executor executor) {
        this.runService = runService;
        this.runRepository = runRepository;
        this.clock = clock;
        this.executor = executor;
    }

    @Scheduled(cron = "0 0 5 * * MON", zone = "Asia/Seoul")
    public void scheduledKopis() { submit(ImportSource.KOPIS, ImportTrigger.SCHEDULED); }

    @Scheduled(cron = "0 0 7-23 * * *", zone = "Asia/Seoul")
    public void scheduledUniversity() {
        if (isUniversityFocusDate(LocalDate.now(clock))) {
            submit(ImportSource.UNIV_NOTICE, ImportTrigger.SCHEDULED);
        }
    }

    public void submitManual(ImportSource source) {
        runService.assertNotRunning(source);
        submit(source, ImportTrigger.MANUAL);
    }

    public Optional<ImportRun> latest(ImportSource source) {
        return source == null ? Optional.empty() : runRepository.findTopBySourceOrderByStartedAtDescIdDesc(source);
    }

    boolean isUniversityFocusDate(LocalDate date) {
        int md = date.getMonthValue() * 100 + date.getDayOfMonth();
        return in(md, 325, 410) || in(md, 525, 605) || in(md, 701, 920)
                || in(md, 1101, 1130) || in(md, 1226, 1231) || in(md, 101, 131);
    }

    private boolean in(int value, int from, int to) { return value >= from && value <= to; }

    private void submit(ImportSource source, ImportTrigger trigger) {
        executor.execute(() -> runService.run(source, trigger));
    }
}
