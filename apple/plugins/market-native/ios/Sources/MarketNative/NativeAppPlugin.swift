import Foundation
import AVFoundation
import UIKit
import Capacitor

/// Uygulama ayarları: ses oturumu "ambient" (sessiz anahtarına uyar, kullanıcının müziğini kesmez),
/// ekran kararmasını engelleme. JS: registerPlugin('NativeApp')
@objc(NativeAppPlugin)
public class NativeAppPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeAppPlugin"
    public let jsName = "NativeApp"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setKeepAwake", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "info", returnType: CAPPluginReturnPromise)
    ]

    override public func load() {
        try? AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
    }

    @objc func setKeepAwake(_ call: CAPPluginCall) {
        let on = call.getBool("on") ?? false
        DispatchQueue.main.async {
            UIApplication.shared.isIdleTimerDisabled = on
            call.resolve()
        }
    }

    @objc func info(_ call: CAPPluginCall) {
        let info = Bundle.main.infoDictionary ?? [:]
        call.resolve([
            "version": info["CFBundleShortVersionString"] as? String ?? "",
            "build": info["CFBundleVersion"] as? String ?? "",
            "idiom": UIDevice.current.userInterfaceIdiom == .pad ? "pad" : "phone"
        ])
    }
}
