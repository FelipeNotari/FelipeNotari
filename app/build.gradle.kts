plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.felipenotari.lanchonete"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.felipenotari.lanchonete"
        minSdk = 24
        targetSdk = 34
        versionCode = 4
        versionName = "1.3"
    }

    signingConfigs {
        create("lanchonete") {
            storeFile = file("lanchonete.keystore")
            storePassword = "lanchonete123"
            keyAlias = "lanchonete"
            keyPassword = "lanchonete123"
        }
    }

    buildTypes {
        debug {
            // Assinatura fixa: garante que uma nova versao instale POR CIMA da
            // anterior, sem desinstalar e sem perder os lancamentos salvos.
            signingConfig = signingConfigs.getByName("lanchonete")
        }
        release {
            signingConfig = signingConfigs.getByName("lanchonete")
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.09.03"))
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-compose:1.9.2")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.6")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.6")
}
