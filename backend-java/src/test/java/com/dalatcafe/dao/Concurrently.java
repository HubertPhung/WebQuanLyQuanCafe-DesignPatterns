package com.dalatcafe.dao;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

/** Khởi động mọi tác vụ cùng một lúc để các thao tác đọc và ghi của chúng đan xen nhau. */
final class Concurrently {
    private Concurrently() {
    }

    static void run(List<Runnable> tasks) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(tasks.size());
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<?>> running = new ArrayList<>();
            for (Runnable task : tasks) {
                running.add(pool.submit(() -> {
                    start.await();
                    task.run();
                    return null;
                }));
            }
            start.countDown();
            for (Future<?> future : running) {
                future.get(60, TimeUnit.SECONDS);
            }
        } finally {
            pool.shutdownNow();
        }
    }
}
