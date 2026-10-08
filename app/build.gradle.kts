plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.northstardigitallabs.chaosdrop"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.northstardigitallabs.chaosdrop"
        minSdk = 23
        targetSdk = 35
        versionCode = 7
        versionName = "0.3.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}
