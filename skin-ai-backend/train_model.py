print("TRAIN MODEL BERJALAN...")
import tensorflow as tf
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras import layers, models
import matplotlib.pyplot as plt
import os


# FOLDER DATASET
DATASET_PATH = "dataset"

# SETTING GAMBAR & BATCH
IMG_SIZE = (224, 224)
BATCH_SIZE = 16

# DATA AUGMENTSI
datagen = ImageDataGenerator(
    rescale=1./255,
    validation_split=0.2,

    rotation_range=15,
    zoom_range=0.1,
    horizontal_flip=True,
    brightness_range=[0.8, 1.2],
)

# TRAIN DATA
train_data = datagen.flow_from_directory(
    DATASET_PATH,
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    class_mode='categorical',
    subset='training'
)

# VALIDASI DATA
val_data = datagen.flow_from_directory(
    DATASET_PATH,
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    class_mode='categorical',
    subset='validation'
)

# CNN MODEL 
model = models.Sequential([

    layers.Conv2D(32, (3,3), activation='relu', input_shape=(224,224,3)),
    layers.MaxPooling2D(2,2),

    layers.Conv2D(64, (3,3), activation='relu'),
    layers.MaxPooling2D(2,2),

    layers.Conv2D(128, (3,3), activation='relu'),
    layers.MaxPooling2D(2,2),

    layers.Flatten(),

    layers.Dense(128, activation='relu'),
    layers.Dropout(0.5),

    layers.Dense(5, activation='softmax')
])

# kompile
model.compile(
    optimizer='adam',
    loss='categorical_crossentropy',
    metrics=['accuracy']
)

# SUMMARY
model.summary()

# TRAINING
history = model.fit(
    train_data,
    validation_data=val_data,
    epochs=10
)

# SAVE MODEL ke folder
os.makedirs("model", exist_ok=True)

model.save("model/model.h5")

print("\nMODEL BERHASIL DISIMPAN!")

# PLOT akurasi
plt.plot(history.history['accuracy'])
plt.plot(history.history['val_accuracy'])

plt.title('Model Accuracy')
plt.ylabel('Accuracy')
plt.xlabel('Epoch')

plt.legend(['Train', 'Validation'])

plt.show()