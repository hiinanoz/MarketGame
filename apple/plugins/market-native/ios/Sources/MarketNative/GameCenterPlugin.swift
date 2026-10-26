import Foundation
import Capacitor
import GameKit

/// Game Center: oyuncu girişi, başarımlar, liderlik tabloları, Game Center paneli ve erişim noktası.
/// JS: registerPlugin('GameCenter')
@objc(GameCenterPlugin)
public class GameCenterPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "GameCenterPlugin"
    public let jsName = "GameCenter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reportAchievement", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showDashboard", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setAccessPoint", returnType: CAPPluginReturnPromise)
    ]

    /// Sessiz giriş: oyuncu daha önce giriş yaptıysa hemen döner; yapmadıysa iOS kendi giriş ekranını gösterir.
    @objc func authenticate(_ call: CAPPluginCall) {
        let player = GKLocalPlayer.local
        player.authenticateHandler = { [weak self] viewController, error in
            if let vc = viewController {
                DispatchQueue.main.async {
                    self?.bridge?.viewController?.present(vc, animated: true)
                }
                return
            }
            if let error = error {
                call.resolve(["authenticated": false, "error": error.localizedDescription])
                return
            }
            call.resolve([
                "authenticated": player.isAuthenticated,
                "playerID": player.gamePlayerID,
                "alias": player.alias
            ])
        }
    }

    @objc func submitScore(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else { return call.resolve(["ok": false]) }
        guard let id = call.getString("leaderboardID") else { return call.reject("leaderboardID gerekli") }
        let score = call.getInt("score") ?? 0
        GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [id]) { error in
            if let error = error { call.resolve(["ok": false, "error": error.localizedDescription]) }
            else { call.resolve(["ok": true]) }
        }
    }

    @objc func reportAchievement(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else { return call.resolve(["ok": false]) }
        guard let id = call.getString("id") else { return call.reject("id gerekli") }
        let achievement = GKAchievement(identifier: id)
        achievement.percentComplete = call.getDouble("percent") ?? 100
        achievement.showsCompletionBanner = true
        GKAchievement.report([achievement]) { error in
            if let error = error { call.resolve(["ok": false, "error": error.localizedDescription]) }
            else { call.resolve(["ok": true]) }
        }
    }

    /// Game Center paneli (başarımlar / tablolar).
    @objc func showDashboard(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let vc = GKGameCenterViewController(state: .default)
            vc.gameCenterDelegate = self
            self.bridge?.viewController?.present(vc, animated: true)
            call.resolve()
        }
    }

    /// Erişim noktası: sadece ana menüde görünür, oyun sırasında gizlenir.
    @objc func setAccessPoint(_ call: CAPPluginCall) {
        let active = call.getBool("active") ?? false
        DispatchQueue.main.async {
            GKAccessPoint.shared.location = .topLeading
            GKAccessPoint.shared.isActive = active && GKLocalPlayer.local.isAuthenticated
            call.resolve()
        }
    }

    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }
}
