# Stage 1: Build the .NET API Assemblies
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build-env
WORKDIR /app

# Copy project files and restore dependencies
COPY ["GlobalAcademy.csproj", "./"]
RUN dotnet restore "GlobalAcademy.csproj"

# Copy the remaining backend code assets
COPY . .
RUN dotnet build "GlobalAcademy.csproj" -c Release -o /app/build

# 🚀 FIX 1: Linked directly to the correct 'build-env' stage alias name defined above
FROM build-env AS publish
RUN dotnet publish "GlobalAcademy.csproj" -c Release -o /app/publish /p:UseAppHost=false

# 🚀 FIX 2: Restored standard production .NET 10 Web API hosting dependencies 
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .

# Expose the internal port to the Docker mesh network
EXPOSE 8080

ENTRYPOINT ["dotnet", "GlobalAcademy.dll"]
