import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        // Eien's, which registers its own file plugin (VaultFilesPlugin.swift): the window is made
        // here, not by Main.storyboard (Capacitor 8.5's scenes).
        window?.rootViewController = MainViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    /// The window saves as it goes to the background (the App plugin's pause): a few seconds
    /// asked for, so iOS doesn't suspend it partway through.
    func sceneDidEnterBackground(_ scene: UIScene) {
        var task = UIBackgroundTaskIdentifier.invalid
        let end = {
            if task != .invalid { UIApplication.shared.endBackgroundTask(task) }
            task = .invalid
        }
        task = UIApplication.shared.beginBackgroundTask(withName: "Eien saves", expirationHandler: end)
        DispatchQueue.main.asyncAfter(deadline: .now() + 10, execute: end)
    }
}
