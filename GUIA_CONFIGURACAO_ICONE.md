# Guia para Configurar o Ícone do Aplicativo G Log no Android Studio

Este guia fornece instruções passo a passo para configurar o ícone do aplicativo G Log no Android Studio.

## Preparação

1. **Prepare seu arquivo de ícone**:
   - Use uma imagem PNG de alta resolução (pelo menos 1024x1024 pixels)
   - Idealmente, a imagem deve ter fundo transparente
   - Coloque o arquivo na pasta raiz do projeto

2. **Sincronize o projeto com o Capacitor**:
   ```bash
   npm run cap:sync
   ```

## Configuração do Ícone no Android Studio

### Passo 1: Abra o projeto no Android Studio

```bash
npm run cap:open:android
```

### Passo 2: Acesse o Asset Studio

1. No Android Studio, expanda a estrutura do projeto no painel esquerdo
2. Clique com o botão direito na pasta `app`
3. Selecione `New > Image Asset`

![Acesso ao Image Asset](https://i.imgur.com/example1.png)

### Passo 3: Configure o ícone do launcher

1. Na janela "Asset Studio":
   - Em "Icon Type", selecione "Launcher Icons (Adaptive and Legacy)"
   - Em "Path", clique em "..." e navegue até o arquivo de ícone que você preparou
   - Ajuste o recorte e as configurações conforme necessário
   - Você pode personalizar o "Foreground Layer" (camada de primeiro plano) e o "Background Layer" (camada de fundo)
   - Recomendamos usar uma cor de fundo que combine com seu ícone (por exemplo, #1E3A8A para o azul do G Log)

![Configuração do Launcher Icon](https://i.imgur.com/example2.png)

2. Clique em "Next" para ver a prévia dos ícones que serão gerados
3. Clique em "Finish" para gerar os ícones

### Passo 4: Configure o ícone da tela de splash (opcional)

1. Repita o processo de acesso ao Asset Studio (Passo 2)
2. Na janela "Asset Studio":
   - Em "Icon Type", selecione "Notification Icons"
   - Configure o ícone da mesma forma que no Passo 3
3. Clique em "Next" e depois em "Finish"

### Passo 5: Configurar o ícone adaptativo (Android 8.0+)

Para dispositivos Android 8.0 (Oreo) e superiores, você pode configurar um ícone adaptativo:

1. Navegue até `android/app/src/main/res/mipmap-anydpi-v26/`
2. Abra os arquivos `ic_launcher.xml` e `ic_launcher_round.xml`
3. Verifique se eles estão configurados corretamente:

```xml
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
```

## Verificação e Construção do APK

### Passo 1: Verifique os ícones gerados

Navegue pelas pastas de recursos para verificar se os ícones foram gerados corretamente:
- `android/app/src/main/res/mipmap-hdpi/`
- `android/app/src/main/res/mipmap-mdpi/`
- `android/app/src/main/res/mipmap-xhdpi/`
- `android/app/src/main/res/mipmap-xxhdpi/`
- `android/app/src/main/res/mipmap-xxxhdpi/`

### Passo 2: Construa o APK

```bash
npm run cap:build:android
```

O APK será gerado em:
`android/app/build/outputs/apk/debug/app-debug.apk`

### Passo 3: Teste o APK

Instale o APK em um dispositivo Android ou emulador para verificar se o ícone está sendo exibido corretamente.

## Solução de Problemas

### O ícone não aparece corretamente

- Verifique se o formato da imagem é PNG
- Certifique-se de que a imagem tem resolução suficiente
- Tente ajustar as configurações de recorte no Asset Studio
- Limpe o cache do projeto: `File > Invalidate Caches / Restart`

### Erro ao gerar os ícones

- Verifique se você tem permissões de escrita nas pastas de recursos
- Tente fechar e reabrir o Android Studio
- Verifique se há espaço suficiente em disco

## Recursos Adicionais

- [Documentação oficial do Android sobre ícones adaptáveis](https://developer.android.com/guide/practices/ui_guidelines/icon_design_adaptive)
- [Guia de design de ícones do Material Design](https://material.io/design/iconography/product-icons.html) 