import React from 'react';

interface ConstructionLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'icon';
  darkMode?: boolean;
}

const ConstructionLogo: React.FC<ConstructionLogoProps> = ({ 
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
      iconSize: 30
    },
    md: {
      height: 40,
      width: variant === 'full' ? 130 : 40,
      fontSize: 20,
      iconSize: 40
    },
    lg: {
      height: 50,
      width: variant === 'full' ? 160 : 50,
      fontSize: 24,
      iconSize: 50
    }
  };

  const currentSize = sizes[size];

  // Cores da marca
  const textColor = darkMode ? 'white' : '#333';

  if (variant === 'icon') {
    return (
      <div style={{ 
        height: currentSize.height, 
        width: currentSize.height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}>
        <img 
          src="/favicon.svg" 
          alt="G-Log Logo" 
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'contain' 
          }} 
        />
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
      <div style={{ 
        height: currentSize.height, 
        width: currentSize.height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}>
        <img 
          src="/favicon.svg" 
          alt="G-Log Icon" 
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'contain' 
          }} 
        />
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

export default ConstructionLogo; 