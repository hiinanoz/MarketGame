// swift-tools-version: 5.9
import PackageDescription

// Market Krallığı'un uygulama içi Capacitor eklentileri (Game Center, iCloud kayıt, ses oturumu).
let package = Package(
    name: "MarketNative",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "MarketNative", targets: ["MarketNative"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "MarketNative",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/MarketNative")
    ]
)
