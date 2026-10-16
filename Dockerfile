FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q package -DskipTests

FROM eclipse-temurin:21-jre
RUN apt-get update \
    && apt-get install -y --no-install-recommends fontconfig \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 esign \
    && mkdir -p /data && chown esign /data
USER esign
WORKDIR /app
COPY --from=build /src/target/esign-api-*.jar app.jar
ENV JAVA_TOOL_OPTIONS="-Djava.awt.headless=true"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
