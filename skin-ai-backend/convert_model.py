import tensorflow as tf

model = tf.keras.models.load_model(
    "model/model_fixed.h5",
    compile=False
)

model.export("saved_model")

print("MODEL BERHASIL DIKONVERSI")