import { useEffect, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Check, PanelLeftClose, PanelLeft, PanelRightClose, PanelRight } from 'lucide-react';
import { 
  Dialog, 
  DialogContent,
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  RadioGroup, 
  RadioGroupItem 
} from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';
import { useToast } from '@/hooks/use-toast';

// Background options
const backgroundOptions = [
  { id: 'default', name: 'Default', preview: '#f8f9fa' },
  { id: 'subtle-patterns', name: 'Subtle Patterns', preview: 'url("https://www.transparenttextures.com/patterns/asfalt-light.png")' },
  { id: 'gradient-blue', name: 'Blue Gradient', preview: 'linear-gradient(135deg, #e0f7fa 0%, #bbdefb 100%)' },
  { id: 'gradient-green', name: 'Green Gradient', preview: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)' },
  { id: 'gradient-purple', name: 'Purple Gradient', preview: 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)' },
  { id: 'dots', name: 'Dots', preview: 'radial-gradient(#000 1px, transparent 0) 0 0 / 20px 20px' },
];

// Layout options
const layoutOptions = [
  { id: 'default', name: 'Default', icon: <PanelLeft className="h-5 w-5" /> },
  { id: 'compact', name: 'Compact', icon: <PanelLeftClose className="h-5 w-5" /> },
  { id: 'wide', name: 'Wide', icon: <PanelRight className="h-5 w-5" /> },
  { id: 'minimal', name: 'Minimal', icon: <PanelRightClose className="h-5 w-5" /> },
];

// Theme colors
const themeColors = [
  { name: 'Blue', value: '#4A7DFF' },
  { name: 'Purple', value: '#6C63FF' },
  { name: 'Green', value: '#00C853' },
  { name: 'Red', value: '#F44336' },
  { name: 'Orange', value: '#FF9800' },
  { name: 'Teal', value: '#009688' },
];

interface ThemeSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ThemeSettings({ open, onOpenChange }: ThemeSettingsProps) {
  const { theme, setTheme, primaryColor, setPrimaryColor, background, setBackground, saveSettings } = useTheme();
  const { toast } = useToast();
  const [selectedBackground, setSelectedBackground] = useState(background);
  const [selectedColor, setSelectedColor] = useState(primaryColor);
  const [selectedTheme, setSelectedTheme] = useState(theme);
  const [selectedLayout, setSelectedLayout] = useState('default');
  const [customColor, setCustomColor] = useState(primaryColor);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  
  // Reset local state when modal opens
  useEffect(() => {
    if (open) {
      setSelectedBackground(background);
      setSelectedColor(primaryColor);
      setSelectedTheme(theme);
      setCustomColor(primaryColor);
    }
  }, [open, background, primaryColor, theme]);
  
  // Preview changes as user selects options
  useEffect(() => {
    if (open) {
      setPrimaryColor(selectedColor);
      setBackground(selectedBackground);
      setTheme(selectedTheme);
    }
  }, [selectedColor, selectedBackground, selectedTheme, open]);
  
  // Save settings
  const handleSave = async () => {
    try {
      await saveSettings();
      
      toast({
        title: "Settings saved",
        description: "Your theme preferences have been updated."
      });
      
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error saving settings",
        description: "Failed to save your theme preferences.",
        variant: "destructive"
      });
    }
  };
  
  // Cancel changes
  const handleCancel = () => {
    // Reset to original values
    setPrimaryColor(primaryColor);
    setBackground(background);
    setTheme(theme);
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Customize Appearance</DialogTitle>
          <DialogDescription>
            Personalize the look and feel of RBLXC to match your style
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="theme">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="theme">Theme</TabsTrigger>
            <TabsTrigger value="colors">Colors</TabsTrigger>
            <TabsTrigger value="background">Background</TabsTrigger>
          </TabsList>
          
          {/* Theme Tab */}
          <TabsContent value="theme" className="space-y-4 py-4">
            <div>
              <h3 className="text-lg font-medium mb-2">Display Mode</h3>
              <div className="grid grid-cols-3 gap-4">
                <div
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedTheme === 'light' ? 'border-primary bg-primary-light' : 'hover:border-neutral-300'
                  }`}
                  onClick={() => setSelectedTheme('light')}
                >
                  <div className="h-24 bg-white border border-neutral-200 rounded-md mb-2 flex items-center justify-center shadow-sm">
                    <div className="w-3/4 h-3/4 bg-neutral-50 rounded flex items-center justify-center">
                      <Sun className="h-8 w-8 text-amber-500" />
                    </div>
                  </div>
                  <p className="text-center font-medium">Light</p>
                </div>
                
                <div
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedTheme === 'dark' ? 'border-primary bg-primary-light' : 'hover:border-neutral-300'
                  }`}
                  onClick={() => setSelectedTheme('dark')}
                >
                  <div className="h-24 bg-neutral-900 border border-neutral-700 rounded-md mb-2 flex items-center justify-center shadow-sm">
                    <div className="w-3/4 h-3/4 bg-neutral-800 rounded flex items-center justify-center">
                      <Moon className="h-8 w-8 text-indigo-400" />
                    </div>
                  </div>
                  <p className="text-center font-medium">Dark</p>
                </div>
                
                <div
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedTheme === 'system' ? 'border-primary bg-primary-light' : 'hover:border-neutral-300'
                  }`}
                  onClick={() => setSelectedTheme('system')}
                >
                  <div className="h-24 bg-gradient-to-r from-white to-neutral-900 border border-neutral-200 rounded-md mb-2 flex items-center justify-center shadow-sm">
                    <div className="flex items-center space-x-2">
                      <Sun className="h-6 w-6 text-amber-500" />
                      <span className="text-lg font-bold">/</span>
                      <Moon className="h-6 w-6 text-indigo-400" />
                    </div>
                  </div>
                  <p className="text-center font-medium">System</p>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-2">Layout</h3>
              <RadioGroup 
                value={selectedLayout} 
                onValueChange={setSelectedLayout}
                className="grid grid-cols-2 gap-4"
              >
                {layoutOptions.map(layout => (
                  <div key={layout.id} className="flex items-start space-x-2">
                    <RadioGroupItem value={layout.id} id={`layout-${layout.id}`} className="mt-1" />
                    <Label 
                      htmlFor={`layout-${layout.id}`}
                      className="flex items-center space-x-2 cursor-pointer"
                    >
                      <div className="bg-neutral-100 p-2 rounded-md dark:bg-neutral-800">
                        {layout.icon}
                      </div>
                      <span>{layout.name}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </TabsContent>
          
          {/* Colors Tab */}
          <TabsContent value="colors" className="space-y-4 py-4">
            <div>
              <h3 className="text-lg font-medium mb-2">Primary Color</h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 mb-4">
                {themeColors.map(color => (
                  <div
                    key={color.value}
                    className={`relative rounded-lg cursor-pointer border-2 transition-all ${
                      selectedColor === color.value ? 'border-black dark:border-white' : 'border-transparent'
                    }`}
                    onClick={() => setSelectedColor(color.value)}
                  >
                    <div 
                      className="h-12 rounded-md flex items-center justify-center"
                      style={{ backgroundColor: color.value }}
                    >
                      {selectedColor === color.value && (
                        <Check className="h-5 w-5 text-white" />
                      )}
                    </div>
                    <p className="text-center text-xs mt-1">{color.name}</p>
                  </div>
                ))}
                
                {/* Custom color option */}
                <div
                  className={`relative rounded-lg cursor-pointer border-2 transition-all ${
                    !themeColors.some(c => c.value === selectedColor) ? 'border-black dark:border-white' : 'border-transparent'
                  }`}
                  onClick={() => {
                    setSelectedColor(customColor);
                    setColorPickerOpen(true);
                  }}
                >
                  <div 
                    className="h-12 rounded-md flex items-center justify-center"
                    style={{ backgroundColor: customColor }}
                  >
                    {!themeColors.some(c => c.value === selectedColor) && (
                      <Check className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <p className="text-center text-xs mt-1">Custom</p>
                </div>
              </div>
              
              {colorPickerOpen && (
                <div className="mt-4 p-4 border rounded-lg">
                  <div className="flex justify-center mb-4">
                    <HexColorPicker 
                      color={customColor} 
                      onChange={color => {
                        setCustomColor(color);
                        setSelectedColor(color);
                      }} 
                    />
                  </div>
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() => setColorPickerOpen(false)}
                    >
                      Done
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
          
          {/* Background Tab */}
          <TabsContent value="background" className="space-y-4 py-4">
            <div>
              <h3 className="text-lg font-medium mb-2">Chat Background</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {backgroundOptions.map(bg => (
                  <div
                    key={bg.id}
                    className={`relative rounded-lg cursor-pointer overflow-hidden border-2 transition-all ${
                      selectedBackground === bg.id ? 'border-primary' : 'border-transparent hover:border-neutral-300'
                    }`}
                    onClick={() => setSelectedBackground(bg.id)}
                  >
                    <div 
                      className="h-28 rounded-md"
                      style={{ 
                        background: bg.preview,
                        backgroundSize: bg.id === 'dots' ? '20px 20px' : 'cover'
                      }}
                    >
                      {selectedBackground === bg.id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20">
                          <Check className="h-8 w-8 text-white" />
                        </div>
                      )}
                    </div>
                    <p className="text-center py-2 font-medium">{bg.name}</p>
                  </div>
                ))}
                
                {/* Upload custom background - not implemented but UI shown */}
                <div
                  className="relative rounded-lg cursor-pointer border-2 border-dashed border-neutral-300 hover:border-neutral-400"
                  onClick={() => {
                    toast({
                      title: "Custom backgrounds",
                      description: "Custom background upload is not implemented in this version."
                    });
                  }}
                >
                  <div className="h-28 rounded-md flex flex-col items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm text-neutral-500 mt-2">Upload Image</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Mock components for theme tab display
function Sun({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>
  );
}

function Moon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
  );
}
