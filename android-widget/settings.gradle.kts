// Приложение-виджет «Календарь ателье» для Android. Собирается на GitHub: .github/workflows/android.yml
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "CalendarAtelier"
include(":app")
