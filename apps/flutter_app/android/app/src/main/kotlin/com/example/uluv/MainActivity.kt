package com.example.uluv

import android.os.Build
import android.os.Bundle
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** P01-3 device-bound, encrypted auth state: never writes plaintext credentials. */
class MainActivity : FlutterActivity() {
    private val channel = "uluv/p01_3_secure"
    private val signingAlias = "uluv.p01_3.device.sign.v1"
    private val cipherAlias = "uluv.p01_3.device.store.v1"
    private val preferences = "uluv_p01_3_sealed"
    private val storedKey = "record"
    private fun ks(): KeyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    private fun base64(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)
    private fun shaUrl(value: String): String = Base64.encodeToString(MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray(Charsets.UTF_8)), Base64.NO_WRAP or Base64.URL_SAFE or Base64.NO_PADDING)

    private fun ensureSigner(): String {
        require(Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) { "Android 6 or newer is required for secure sessions" }
        if (!ks().containsAlias(signingAlias)) {
            val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
            generator.initialize(KeyGenParameterSpec.Builder(signingAlias, KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY)
                .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setUserAuthenticationRequired(false).build())
            generator.generateKeyPair()
        }
        return base64(requireNotNull(ks().getCertificate(signingAlias)).publicKey.encoded)
    }

    private fun signer() = requireNotNull(ks().getKey(signingAlias, null) as? java.security.PrivateKey) {
        "Device signing key not found"
    }

    private fun signProof(arguments: Map<*, *>): String {
        val op = arguments["operation"] as? String ?: error("Missing proof purpose")
        require(op in setOf("enroll", "refresh", "logout"))
        val uid = arguments["uid"] as? String ?: error("Missing account")
        val slot = arguments["slot"] as? Int ?: error("Missing slot")
        val family = arguments["familyId"] as? String ?: error("Missing family")
        val generation = arguments["generation"] as? Int ?: error("Missing generation")
        val credential = arguments["credential"] as? String ?: error("Missing credential")
        val nonce = arguments["nonce"] as? String ?: error("Missing nonce")
        val path = when (op) {
            "enroll" -> "/v1/auth/device/enroll"
            "refresh" -> "/v1/auth/device/refresh"
            else -> "/v1/auth/device/logout"
        }
        val message = "ULUV-P01-3-V1\n$op\n$path\n$uid\n$slot\n$family\n$generation\n${shaUrl(credential)}\n$nonce"
        val signature = Signature.getInstance("SHA256withECDSA")
        signature.initSign(signer())
        signature.update(message.toByteArray(Charsets.UTF_8))
        return base64(signature.sign())
    }

    private fun encryptionKey(create: Boolean): SecretKey {
        if (!ks().containsAlias(cipherAlias)) {
            require(create) { "Device encryption key is no longer available" }
            val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
            generator.init(KeyGenParameterSpec.Builder(cipherAlias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256).build())
            generator.generateKey()
        }
        return requireNotNull(ks().getKey(cipherAlias, null) as? SecretKey)
    }

    private fun read(): String? {
        val value = getSharedPreferences(preferences, MODE_PRIVATE).getString(storedKey, null) ?: return null
        val all = Base64.decode(value, Base64.NO_WRAP)
        require(all.size > 28) { "Corrupt sealed credential" }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, encryptionKey(false), GCMParameterSpec(128, all.copyOfRange(0, 12)))
        return String(cipher.doFinal(all.copyOfRange(12, all.size)), Charsets.UTF_8)
    }

    private fun write(value: String): Boolean {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, encryptionKey(true))
        val encoded = cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        return getSharedPreferences(preferences, MODE_PRIVATE).edit().putString(storedKey, base64(encoded)).commit()
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channel).setMethodCallHandler { call, result ->
            try {
                when (call.method) {
                    "publicKey" -> result.success(ensureSigner())
                    "sign" -> result.success(signProof(call.arguments as? Map<*, *> ?: emptyMap<String, String>()))
                    "read" -> result.success(read())
                    "write" -> result.success(write(call.arguments as? String ?: error("Missing record")))
                    "clear" -> result.success(getSharedPreferences(preferences, MODE_PRIVATE).edit().remove(storedKey).commit())
                    else -> result.notImplemented()
                }
            } catch (_: Exception) {
                // Never expose credentials, signing material or raw transport data through error text.
                result.error("DEVICE_SECURE_STORE", "Protected device credential operation failed", null)
            }
        }
    }
}
