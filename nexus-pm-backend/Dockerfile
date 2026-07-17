FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN apk add --no-cache wget openssl \
    && mkdir -p /app/keys \
    && openssl genrsa -out /app/keys/private.pem 2048 \
    && openssl rsa -in /app/keys/private.pem -pubout -out /app/keys/public.pem
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
