---
trigger: always_on
---

# QUY CHUẨN KIẾN TRÚC & CÔNG NGHỆ DỰ ÁN ĐÀ LẠT CAFE

## 1. Ràng buộc Backend Java (Bắt buộc)
- **Nền tảng:** Sử dụng **Java SE 17+ thuần túy (Pure Java OOP)**.
- **NGHIÊM CẤM:** Tuyệt đối KHÔNG sử dụng Spring Boot, Spring Security, Spring Data JPA, Hibernate, Quarkus hay bất kỳ framework backend nào.
- **Mẫu thiết kế (Design Patterns):** Mọi logic nghiệp vụ cốt lõi phải triển khai theo đúng 9 mẫu GoF đã đặc tả trong `docs/DESIGN_PATTERNS_SPEC.md`:
  - *Creational:* Singleton (`SystemConfigManager`), Factory Method (`PaymentProcessorFactory`), Builder (`OrderBuilder`).
  - *Structural:* Decorator (`ToppingDecorator`), Adapter (`ReservationToOrderAdapter`), Facade (`PosCheckoutFacade`).
  - *Behavioral:* Strategy (`DiscountStrategy`), Chain of Responsibility (`ReservationValidator`), Observer (`OrderEventSubject`).
- **Giao thức mạng:** Sử dụng `com.sun.net.httpserver.HttpServer` của Java SE để mở cổng 8080 tiếp nhận REST JSON.
- **Truy xuất CSDL:** Sử dụng `java.sql.*` (JDBC chuẩn) kết nối PostgreSQL/Supabase, triển khai theo mô hình DAO pattern độc lập.
- **Kiểm thử:** Sử dụng JUnit 5 thuần túy để viết Unit Test cho từng Design Pattern.

## 2. Ràng buộc Frontend Next.js
- Sử dụng **Next.js 16 (App Router)**, React 19, TypeScript và Tailwind CSS v4.
- Tuân thủ cấu trúc Server Components, Server Actions (`app/admin/actions.ts`) và Route Handlers (`app/api/`).
- Duy trì cơ chế Zero-crash với In-memory Mock Store fallback (`lib/db/mock-store.ts`).

