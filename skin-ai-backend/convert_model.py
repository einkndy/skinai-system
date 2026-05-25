import keras
import tensorflow as tf

print("Loading modern model...")

# load model modern
model = keras.models.load_model(
    "model/model.h5",
    compile=False
)

print("Saving compatible model...")

# save ulang ke format tensorflow lama
tf.keras.models.save_model(
    model,
    "model/model_fixed.h5",
    save_format="h5"
)

print("MODEL FIXED SUCCESS")