import React from 'react';

interface GLogLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'icon';
  darkMode?: boolean;
}

const GLogLogo: React.FC<GLogLogoProps> = ({ 
  size = 'md', 
  variant = 'full',
  darkMode = false
}) => {
  // Definir tamanhos baseados no parâmetro size
  const sizes = {
    sm: {
      height: 30,
      width: variant === 'full' ? 100 : 30,
      fontSize: 16,
      iconSize: 18
    },
    md: {
      height: 40,
      width: variant === 'full' ? 130 : 40,
      fontSize: 20,
      iconSize: 24
    },
    lg: {
      height: 50,
      width: variant === 'full' ? 160 : 50,
      fontSize: 24,
      iconSize: 30
    }
  };

  const currentSize = sizes[size];

  // Cores da marca
  const primaryColor = '#0369a1'; // Azul principal
  const secondaryColor = '#0ea5e9'; // Azul secundário
  const accentColor = '#f59e0b'; // Laranja para destaque
  
  // Cores para modo escuro (cabeçalho)
  const textColor = darkMode ? 'white' : primaryColor;

  if (variant === 'icon') {
    return (
      <div 
        style={{ 
          height: currentSize.height, 
          width: currentSize.height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: darkMode ? 'white' : primaryColor,
          borderRadius: '8px',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
      >
        <div style={{ 
          position: 'absolute', 
          bottom: '-5px', 
          right: '-5px', 
          width: '60%', 
          height: '60%', 
          backgroundColor: secondaryColor,
          borderRadius: '50%',
          opacity: 0.7
        }} />
        <span style={{ 
          color: darkMode ? primaryColor : 'white', 
          fontWeight: 'bold', 
          fontSize: currentSize.iconSize,
          fontFamily: 'Arial, sans-serif',
          position: 'relative',
          zIndex: 1
        }}>
          G
        </span>
      </div>
    );
  }

  return (
    <div style={{ 
      height: currentSize.height, 
      width: currentSize.width,
      display: 'flex',
      alignItems: 'center'
    }}>
      <div 
        style={{ 
          height: currentSize.height, 
          width: currentSize.height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: darkMode ? 'white' : primaryColor,
          borderRadius: '8px',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.1)'
        }}
      >
        <div style={{ 
          position: 'absolute', 
          bottom: '-5px', 
          right: '-5px', 
          width: '60%', 
          height: '60%', 
          backgroundColor: secondaryColor,
          borderRadius: '50%',
          opacity: 0.7
        }} />
        <span style={{ 
          color: darkMode ? primaryColor : 'white', 
          fontWeight: 'bold', 
          fontSize: currentSize.iconSize,
          fontFamily: 'Arial, sans-serif',
          position: 'relative',
          zIndex: 1
        }}>
          G
        </span>
      </div>
      <div style={{ 
        marginLeft: '8px', 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center'
      }}>
        <span style={{ 
          color: textColor, 
          fontWeight: 'bold', 
          fontSize: currentSize.fontSize,
          fontFamily: 'Arial, sans-serif',
          lineHeight: 1,
          letterSpacing: '0.5px',
          textShadow: darkMode ? '0 1px 2px rgba(0,0,0,0.3)' : 'none'
        }}>
          G-Log
        </span>
      </div>
    </div>
  );
};

export default GLogLogo; 